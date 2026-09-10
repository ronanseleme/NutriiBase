// Supabase Edge Function: chat-assistant
//
// Serve o Chat IA e as recomendações de Insights. Recebe do frontend um
// resumo em texto do perfil/histórico do usuário (já montado no cliente a
// partir dos dados que ele já tem carregados) e chama a API da Anthropic
// (Claude) server-side, nunca expondo a chave no frontend.
//
// Deploy: supabase functions deploy chat-assistant
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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

async function callAnthropic(anthropicKey: string, systemPrompt: string, userPrompt: string) {
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
}

function extractText(anthropicJson: any): string {
  return ((anthropicJson?.content || []) as { type: string; text?: string }[])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
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

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return errorResponse("upstream_error", "IA não configurada no servidor.", 500);
  }

  if (mode === "insights") {
    const prompt =
      context +
      "\n\nCom base nesses dados, escreva de 3 a 4 recomendações curtas e práticas para este usuário, focadas em " +
      "ações concretas para os próximos dias — não repita os números já listados acima. Responda APENAS com um " +
      'JSON válido, sem markdown, sem texto antes ou depois, no formato exato: {"tips": [string, string, ...]}.';

    let anthropicRes: Response;
    try {
      anthropicRes = await callAnthropic(anthropicKey, "Você é um nutricionista esportivo experiente e direto.", prompt);
    } catch {
      return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
    }
    if (anthropicRes.status === 429) {
      return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
    }
    if (!anthropicRes.ok) {
      return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
    }

    const text = extractText(await anthropicRes.json());
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
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
    '\n\nResponda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato: ' +
    '{"reply": string, "chips": [string, string, string]}. "reply" é sua resposta direta ao usuário. "chips" são ' +
    "até 3 sugestões curtas (até 6 palavras cada) de continuação da conversa, relevantes ao que foi discutido.";

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n\n");

  let anthropicRes: Response;
  try {
    anthropicRes = await callAnthropic(anthropicKey, systemPrompt, conversationText);
  } catch {
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }
  if (anthropicRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!anthropicRes.ok) {
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const text = extractText(await anthropicRes.json());
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return errorResponse("invalid_json", "A IA não retornou um resultado utilizável.", 422);
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
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
