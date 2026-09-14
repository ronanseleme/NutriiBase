// Supabase Edge Function: chat-assistant
//
// Serve o Chat IA e as recomendações de Insights. Recebe do frontend um
// resumo em texto do perfil/histórico do usuário (já montado no cliente a
// partir dos dados que ele já tem carregados) e chama o Gemini server-side,
// nunca expondo a chave no frontend.
//
// Deploy: supabase functions deploy chat-assistant
// Secret: supabase secrets set GEMINI_API_KEY=AIza...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractGeminiText } from "../_shared/gemini.ts";

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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const TIPS_SCHEMA = {
  type: "OBJECT",
  properties: { tips: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["tips"],
};

const CHAT_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    chips: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["reply", "chips"],
};

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

  // Checa papel/créditos ANTES de gastar uma chamada de IA (cobre tanto o
  // Chat IA quanto os insights com IA da aba Insights) — nunca confia só
  // no frontend.
  const { data: profileRow, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, creditos_ia, data_proxima_renovacao")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profileRow) {
    return errorResponse("upstream_error", "Não foi possível verificar seu acesso.", 500);
  }
  if (profileRow.role === "free") {
    return errorResponse("forbidden_free", "Recurso exclusivo para assinantes Pro.", 403);
  }
  if (profileRow.role === "pro" && (profileRow.creditos_ia ?? 0) <= 0) {
    const dias = profileRow.data_proxima_renovacao
      ? Math.max(0, Math.ceil((new Date(profileRow.data_proxima_renovacao).getTime() - Date.now()) / 86400000))
      : null;
    return errorResponse(
      "limit_reached",
      dias != null
        ? `Seus créditos de IA deste mês acabaram. Renovam em ${dias} dia(s).`
        : "Seus créditos de IA deste mês acabaram.",
      403,
    );
  }

  async function consumeCredit(descricao: string): Promise<boolean> {
    const { data: consumed, error: consumeError } = await supabaseClient.rpc("consumir_credito_ia", { descricao });
    return !consumeError && !!consumed;
  }

  let body: { mode?: string; context?: string; messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Corpo da requisição inválido.", 400);
  }
  const mode = body.mode === "insights" ? "insights" : "chat";
  const context = (body.context || "").trim();
  if (!context) {
    return errorResponse("bad_request", "Contexto do usuário ausente.", 400);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return errorResponse("upstream_error", "IA não configurada no servidor.", 500);
  }

  if (mode === "insights") {
    const prompt =
      "Você é um nutricionista esportivo experiente e direto.\n\n" +
      context +
      "\n\nCom base nesses dados, escreva de 3 a 4 recomendações curtas e práticas para este usuário, focadas em " +
      "ações concretas para os próximos dias — não repita os números já listados acima.";

    let geminiRes: Response;
    try {
      geminiRes = await callGemini({ apiKey: geminiKey, prompt, responseSchema: TIPS_SCHEMA });
    } catch {
      return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
    }
    if (geminiRes.status === 429) {
      return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
    }
    if (!geminiRes.ok) {
      return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
    }

    const text = extractGeminiText(await geminiRes.json());
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
    }
    const tips = (parsed as { tips?: unknown })?.tips;
    if (!Array.isArray(tips) || tips.length === 0) {
      return errorResponse("refused", "Não consegui gerar recomendações a partir desses dados.", 422);
    }
    if (!(await consumeCredit("Insights com IA"))) {
      return errorResponse("limit_reached", "Seus créditos de IA deste mês acabaram.", 403);
    }
    return jsonResponse({ tips: tips.map((t) => String(t).slice(0, 300)).slice(0, 4) });
  }

  // mode === "chat"
  const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return errorResponse("bad_request", "Envie uma mensagem para o assistente.", 400);
  }

  const systemPrompt =
    "Você é um nutricionista esportivo experiente, empático e baseado em evidência, especializado em nutrição " +
    "esportiva e treino. Responda com naturalidade qualquer pergunta do usuário sobre alimentação, dieta, macros, " +
    "suplementação, treino e hábitos saudáveis. Tom direto e motivador, nunca alarmista. Sempre que citar um " +
    "número, explique o que ele significa na prática.\n\n" +
    context +
    '\n\n"chips" na resposta são até 3 sugestões curtas (até 6 palavras cada) de continuação da conversa, ' +
    "relevantes ao que foi discutido.";

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n\n");

  let geminiRes: Response;
  try {
    geminiRes = await callGemini({
      apiKey: geminiKey,
      prompt: `${systemPrompt}\n\n${conversationText}`,
      responseSchema: CHAT_SCHEMA,
    });
  } catch {
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }
  if (geminiRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!geminiRes.ok) {
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const text = extractGeminiText(await geminiRes.json());
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
  }
  const reply = (parsed as { reply?: unknown })?.reply;
  const chips = (parsed as { chips?: unknown })?.chips;
  if (typeof reply !== "string" || !reply.trim()) {
    return errorResponse("refused", "Não consegui responder a essa pergunta.", 422);
  }
  if (!(await consumeCredit("Chat IA"))) {
    return errorResponse("limit_reached", "Seus créditos de IA deste mês acabaram.", 403);
  }
  return jsonResponse({
    reply: reply.trim(),
    chips: Array.isArray(chips) ? chips.map((c) => String(c).slice(0, 80)).slice(0, 3) : [],
  });
});
