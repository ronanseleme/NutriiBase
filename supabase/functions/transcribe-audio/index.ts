// Supabase Edge Function: transcribe-audio
//
// Recebe um áudio gravado no navegador (base64) e usa o Gemini (que aceita
// áudio como entrada multimodal, sem precisar de um modelo de transcrição
// separado) para transcrever em texto. Usado pelo microfone do "Descrever
// refeição com IA" — o texto volta pro frontend, que só preenche o campo de
// descrição; o crédito de IA é gasto depois, quando o usuário perguntar à IA
// (describe-meal), não aqui.
//
// Deploy: supabase functions deploy transcribe-audio
// Secret: supabase secrets set GEMINI_API_KEY=AIza...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractGeminiText } from "../_shared/gemini.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ~6MB de áudio binário (base64 é ~33% maior) — sobra pra uma gravação de
// alguns minutos e evita payloads absurdos batendo na função.
const MAX_AUDIO_BASE64_LENGTH = 8_000_000;

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
  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
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

  // Mesma regra de acesso do "Descrever com IA": ditado por voz é só outra
  // forma de preencher o mesmo campo, então segue a mesma trava de papel
  // (sem gastar crédito aqui — quem cobra é o describe-meal, depois).
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

  let body: { audioBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  const audioBase64 = body.audioBase64 || "";
  const mimeType = body.mimeType || "audio/webm";
  if (!audioBase64) {
    return errorResponse("bad_request", "Nenhum áudio recebido.", 400);
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return errorResponse("bad_request", "Áudio muito longo — grave uma descrição mais curta.", 400);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("transcribe-audio: GEMINI_API_KEY não está configurada nas secrets da função");
    return errorResponse("upstream_error", "Transcrição por voz não configurada no servidor.", 500);
  }

  let geminiRes: Response;
  try {
    geminiRes = await callGemini({
      apiKey: geminiKey,
      prompt:
        "Transcreva o áudio a seguir literalmente, em português do Brasil. " +
        "Responda APENAS com o texto transcrito, sem comentários, sem markdown, " +
        "sem aspas envolvendo o texto. Se o áudio estiver em silêncio ou incompreensível, responda com uma string vazia.",
      parts: [{ inline_data: { mime_type: mimeType, data: audioBase64 } }],
      temperature: 0,
    });
  } catch (err) {
    console.error("transcribe-audio: falha ao chamar o Gemini", err);
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }

  if (geminiRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!geminiRes.ok) {
    console.error("transcribe-audio: Gemini respondeu", geminiRes.status, await geminiRes.text());
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const text = extractGeminiText(await geminiRes.json());

  return jsonResponse({ text });
});
