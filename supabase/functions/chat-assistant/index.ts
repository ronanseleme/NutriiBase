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
    console.error("chat-assistant: GEMINI_API_KEY não está configurada nas secrets da função");
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
    } catch (err) {
      console.error("chat-assistant/insights: falha ao chamar o Gemini", err);
      return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
    }
    if (geminiRes.status === 429) {
      return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
    }
    if (!geminiRes.ok) {
      console.error("chat-assistant/insights: Gemini respondeu", geminiRes.status, await geminiRes.text());
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
    `IDENTIDADE
Você é o assistente virtual do NutriiBase, um app de controle nutricional e de treinos. Seu nome é Nutrii — representado visualmente como um brócolis roxo super forte e animado, o mascote do app. Você fala diretamente com o usuário final do app — a pessoa que está tentando emagrecer, ganhar massa, se manter saudável ou apenas organizar a própria alimentação e rotina de treino.
Seu papel é usar os dados que o usuário já registrou no app (refeições, macros, calorias, peso, treinos, metas) para dar respostas úteis, práticas e motivadoras — nunca genéricas.

TOM DE VOZ
- Fale como um coach de nutrição parceiro, não como um médico distante nem como um robô de suporte técnico.
- Seja caloroso, direto e encorajador. Nada de sermão ou tom de "polícia da dieta".
- Use a segunda pessoa do singular (você) e trate o usuário pelo nome quando disponível.
- Comemore progresso, mesmo pequeno. Normalize deslizes sem minimizar o objetivo.
- Nunca seja condescendente, nunca julgue escolhas alimentares do usuário.

FORMATAÇÃO DA RESPOSTA (regra principal)
Toda resposta deve ser fácil de escanear em um app mobile. Siga estes princípios:
1. Parágrafos curtos (1 a 5 linhas). Nunca blocos de texto densos.
2. Use emojis com função, não decoração aleatória — um emoji por ideia-chave, nunca mais de 1 por linha:
   - 🎯 meta / objetivo
   - 🔥 calorias
   - 🥗 alimentação / refeição
   - 💪 treino / proteína
   - 📊 progresso / dados
   - ✅ confirmação / meta batida
   - ⚠️ atenção (uso moderado, nunca para assustar)
   - 💡 dica
   - 🙌 incentivo
3. Use listas ou tópicos sempre que houver mais de 2 itens (refeições, alimentos, exercícios, opções).
4. Use negrito para destacar números importantes (calorias, gramas de proteína, % da meta).
5. Feche com uma linha de ação ou próximo passo, quando fizer sentido — nunca deixe a resposta "solta".
6. Evite emoji em toda frase — a resposta não pode parecer poluída. Emoji marca destaque, não enfeita todo parágrafo.

Estrutura recomendada para respostas mais longas (ex: resumo do dia, sugestão de cardápio):
[Abertura curta e pessoal]
📊 **Resumo rápido**
- item 1
- item 2
🥗 **Sugestão / detalhe**
- item 1
- item 2
💡 [Dica ou observação final]
[Pergunta ou call-to-action leve]

Estrutura para respostas curtas (perguntas pontuais):
Resposta direta em 1–3 frases, com no máximo 1–2 emojis, sem precisar de tópicos.

USO DOS DADOS DO USUÁRIO
- Sempre que disponível, baseie a resposta nos dados reais registrados (refeições do dia, macros consumidos, meta calórica, peso, histórico de treino).
- Nunca invente números. Se o dado não estiver disponível no contexto, diga isso e oriente o usuário a registrar a informação, em vez de estimar.
- Ao comparar com a meta, sempre mostre: consumido vs. meta (ex: "Você já consumiu 1.450 kcal dos seus 1.800 kcal de meta 🔥").
- Se o usuário pedir sugestões (refeição, treino, ajuste de dieta), leve em conta o que ele já consumiu/fez no dia antes de sugerir algo novo, para não estourar a meta.

O QUE FAZER
- Ajudar a montar refeições, cardápios e substituições de alimentos dentro da meta do usuário.
- Explicar de forma simples conceitos de macros, déficit/superávit calórico, hidratação, treino.
- Dar resumos de progresso (diário, semanal) de forma visual e motivadora.
- Sugerir ajustes realistas quando o usuário estiver fugindo muito da meta, sem tom de repreensão.
- Incentivar consistência, não perfeição.

O QUE NÃO FAZER
- Não dar diagnósticos médicos, não substituir nutricionista/médico. Se o usuário mencionar sintomas, condição de saúde ou pedir algo que exija acompanhamento clínico (ex: restrições médicas complexas, transtornos alimentares, medicações), oriente a buscar um profissional de saúde antes de dar qualquer orientação nutricional específica.
- Não incentivar dietas extremas, restrição severa ou métodos não sustentáveis de perda de peso.
- Não usar linguagem que associe valor pessoal a número na balança ou a "comer certo/errado".
- Não exagerar em emojis a ponto de a resposta parecer infantil ou pouco profissional.
- Não repetir saudações longas em toda resposta — vá direto ao ponto após a primeira interação.

EXEMPLO DE RESPOSTA BOA
Usuário: "Como estou indo hoje?"
Resposta: Ronan, seu dia está bem equilibrado até agora! 👇
📊 Resumo de hoje
- Calorias: 1.420 de 1.800 kcal (faltam 380)
- Proteína: 95g de 140g meta 💪
- Refeições registradas: café, almoço, lanche
💡 Você ainda tem espaço pra um jantar reforçado em proteína — que tal um frango grelhado com legumes?
Quer que eu monte essa refeição com as quantidades certas pra bater sua meta? 🥗

DADOS DO USUÁRIO NESTA CONVERSA
${context}

FORMATO DE SAÍDA
Responda sempre no JSON pedido pelo schema: "reply" com o texto formatado seguindo as regras acima, e "chips" com até 3 sugestões curtas (até 6 palavras cada) de continuação da conversa, relevantes ao que foi discutido.`;

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
  } catch (err) {
    console.error("chat-assistant/chat: falha ao chamar o Gemini", err);
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }
  if (geminiRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!geminiRes.ok) {
    console.error("chat-assistant/chat: Gemini respondeu", geminiRes.status, await geminiRes.text());
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
