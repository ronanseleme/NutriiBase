// Supabase Edge Function: describe-meal
//
// Recebe a descrição em texto livre de uma refeição, chama a API da Anthropic
// (Claude) para separar os alimentos e estimar kcal/macros de cada um, e
// devolve um array estruturado. A chave da IA fica só aqui (variável de
// ambiente da função, nunca no frontend).
//
// Deploy: supabase functions deploy describe-meal
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  // Confirma que quem chamou é um usuário Supabase autenticado (usa só a
  // anon/publishable key + o token do próprio usuário, nunca a service key).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Faça login para usar a IA.", 401);
  }
  const supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  let body: { descricao?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  const descricao = (body.descricao || "").trim();
  if (!descricao) {
    return errorResponse("bad_request", "Descreva o que foi comido.", 400);
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return errorResponse("upstream_error", "IA não configurada no servidor.", 500);
  }

  const prompt =
    "O usuário vai descrever, em português do Brasil, tudo que comeu em uma única refeição, " +
    "podendo ter vários alimentos. Separe a descrição em itens individuais. Para cada item, " +
    "estime a quantidade em GRAMAS da porção (peso da porção descrita, ex: '176 gramas de sobrecoxa assada' -> grams=176; " +
    "se a porção não tiver peso explícito, estime um peso razoável) e as informações nutricionais " +
    "TOTAIS para essa quantidade (não por 100g). Responda APENAS com um array JSON válido, sem " +
    "markdown, sem texto antes ou depois, no formato exato: " +
    '[{"name": string, "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number}, ...] ' +
    "(protein/carbs/fat em gramas, um objeto por item identificado).\n\nRefeição descrita: " +
    descricao;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }

  if (anthropicRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!anthropicRes.ok) {
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const anthropicJson = await anthropicRes.json();
  const text: string = (anthropicJson?.content || [])
    .map((block: { type: string; text?: string }) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
  }

  let items: unknown;
  try {
    items = JSON.parse(match[0]);
  } catch {
    return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("refused", "Não consegui identificar alimentos nessa descrição.", 422);
  }

  const clean = items.map((it: any) => ({
    name: String(it?.name || "Item").slice(0, 80),
    grams: Math.max(0, Math.round(Number(it?.grams) || 0)),
    kcal: Math.max(0, Math.round(Number(it?.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(it?.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(it?.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(it?.fat) || 0)),
  }));

  return jsonResponse({ items: clean });
});
