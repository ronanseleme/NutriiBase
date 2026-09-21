// Supabase Edge Function: analyze-meal-photo
//
// Recebe uma foto do prato (base64) e usa o Gemini (multimodal) pra
// identificar cada alimento visível, estimar porção e calcular kcal/macros.
// Recurso exclusivo Pro — sem custo de créditos (não chama
// consumir_credito_ia): é um benefício incluso na assinatura, não um uso
// medido como o "Descrever com IA" em texto.
//
// Deploy: supabase functions deploy analyze-meal-photo
// Secret: supabase secrets set GEMINI_API_KEY=AIza... (já configurada,
// reaproveitada de describe-meal/chat-assistant/transcribe-audio)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractGeminiText } from "../_shared/gemini.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ~6MB de imagem binária (base64 é ~33% maior) — a foto já vem comprimida
// do client, isso aqui é só um teto de segurança contra payload absurdo.
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;

const PHOTO_SCHEMA = {
  type: "OBJECT",
  properties: {
    erro: { type: "STRING" },
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          grams: { type: "NUMBER" },
          kcal: { type: "NUMBER" },
          protein: { type: "NUMBER" },
          carbs: { type: "NUMBER" },
          fat: { type: "NUMBER" },
          confidence: { type: "STRING", enum: ["alta", "media", "baixa"] },
        },
        required: ["name", "grams", "kcal", "protein", "carbs", "fat", "confidence"],
      },
    },
  },
  required: ["erro", "itens"],
};

const SYSTEM_PROMPT = `Você é um sistema de análise nutricional por imagem. Analise a foto do prato de comida enviada e identifique CADA alimento visível separadamente.

Para cada alimento, estime:
- nome do alimento (em português, específico: ex. "arroz branco cozido" e não só "arroz")
- porção estimada em gramas, usando como referência de escala outros objetos visíveis no prato (talher, prato, copo) quando possível
- calorias totais dessa porção (não por 100g)
- proteína (g), carboidrato (g), gordura (g) totais dessa porção

Regras importantes:
1. Se a imagem estiver borrada, muito escura, ou não mostrar comida claramente, deixe "itens" como array vazio e preencha "erro" com uma breve explicação do motivo.
2. Se a imagem mostrar comida claramente, deixe "erro" como string vazia.
3. Se não conseguir identificar um alimento com confiança, inclua-o mesmo assim mas marque confidence "baixa".
4. Nunca invente alimentos que não estão visíveis na imagem.
5. Baseie as estimativas em valores nutricionais de tabelas brasileiras (TACO) sempre que possível.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse("bad_request", "Use POST.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Faça login para usar a IA.", 401);
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("upstream_error", "Configuração do servidor incompleta (SUPABASE_URL/ANON_KEY).", 500);
  }
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  // Foto com IA é exclusiva Pro — sem exceção de créditos, porque não
  // consome nenhum (nem checa creditos_ia, só o papel).
  const { data: profileRow, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profileRow) {
    return errorResponse("upstream_error", "Não foi possível verificar seu acesso.", 500);
  }
  if (profileRow.role === "free") {
    return errorResponse("forbidden_free", "Recurso exclusivo para assinantes Pro.", 403);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  const imageBase64 = body.imageBase64 || "";
  const mimeType = body.mimeType || "image/jpeg";
  if (!imageBase64) {
    return errorResponse("bad_request", "Nenhuma foto recebida.", 400);
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return errorResponse("bad_request", "Foto muito grande.", 400);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return errorResponse("bad_request", "Formato de imagem não suportado.", 400);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("analyze-meal-photo: GEMINI_API_KEY não está configurada nas secrets da função");
    return errorResponse("upstream_error", "IA não configurada no servidor.", 500);
  }

  let geminiRes: Response;
  try {
    geminiRes = await callGemini({
      apiKey: geminiKey,
      prompt: SYSTEM_PROMPT,
      parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }],
      responseSchema: PHOTO_SCHEMA,
    });
  } catch (err) {
    console.error("analyze-meal-photo: falha ao chamar o Gemini", err);
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }

  if (geminiRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!geminiRes.ok) {
    console.error("analyze-meal-photo: Gemini respondeu", geminiRes.status, await geminiRes.text());
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const text = extractGeminiText(await geminiRes.json());
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
  }

  const erro = (parsed as { erro?: unknown })?.erro;
  if (typeof erro === "string" && erro.trim()) {
    return errorResponse("invalid_image", erro.trim(), 422);
  }

  const itens = (parsed as { itens?: unknown })?.itens;
  if (!Array.isArray(itens) || itens.length === 0) {
    return errorResponse("refused", "Não consegui identificar alimentos nessa foto.", 422);
  }

  const clean = itens.map((it: any) => ({
    name: String(it?.name || "Item").slice(0, 80),
    grams: Math.max(0, Math.round(Number(it?.grams) || 0)),
    kcal: Math.max(0, Math.round(Number(it?.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(it?.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(it?.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(it?.fat) || 0)),
    confidence: ["alta", "media", "baixa"].includes(it?.confidence) ? it.confidence : "media",
  }));

  return jsonResponse({ items: clean });
});
