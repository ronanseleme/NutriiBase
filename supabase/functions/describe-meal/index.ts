// Supabase Edge Function: describe-meal
//
// Recebe a descrição em texto livre de uma refeição, chama o Gemini para
// separar os alimentos e estimar kcal/macros de cada um, e devolve um array
// estruturado. A chave da IA fica só aqui (variável de ambiente da função,
// nunca no frontend). Usa responseSchema do Gemini pra forçar o formato de
// saída no próprio servidor da IA, em vez de caçar JSON no meio do texto.
//
// Deploy: supabase functions deploy describe-meal
// Secret: supabase secrets set GEMINI_API_KEY=AIza...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractGeminiText } from "../_shared/gemini.ts";

const ITEMS_SCHEMA = {
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
    },
    required: ["name", "grams", "kcal", "protein", "carbs", "fat"],
  },
};

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
  // Projetos novos do Supabase expõem "publishable key" em vez de "anon key" —
  // aceita os dois nomes de variável reservada, o que existir.
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

  // Checa papel ANTES de gastar uma chamada de IA — nunca confia só no
  // frontend (que já esconde o recurso pra Free, mas isso aqui é o que
  // realmente impede o uso). Pro tem acesso ilimitado; Free tem um limite
  // diário de 3 estimativas (checado/consumido abaixo).
  const { data: profileRow, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, estimativas_ia_free_hoje, estimativas_ia_free_data")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profileRow) {
    return errorResponse("upstream_error", "Não foi possível verificar seu acesso.", 500);
  }
  const FREE_LIMIT_MESSAGE = "Você já usou suas 3 estimativas de IA gratuitas hoje. Assine o Pro para estimativas ilimitadas.";
  if (profileRow.role === "free") {
    // Checagem "otimista" — evita gastar uma chamada de IA quando já dá pra
    // saber que vai bloquear. A checagem que vale de verdade é atômica, lá
    // embaixo (consumir_estimativa_ia_free), depois da IA responder bem.
    const hoje = new Date().toISOString().slice(0, 10);
    const usadasHoje = profileRow.estimativas_ia_free_data === hoje ? (profileRow.estimativas_ia_free_hoje ?? 0) : 0;
    if (usadasHoje >= 3) {
      return errorResponse("limit_reached", FREE_LIMIT_MESSAGE, 403);
    }
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

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("describe-meal: GEMINI_API_KEY não está configurada nas secrets da função");
    return errorResponse("upstream_error", "IA não configurada no servidor.", 500);
  }

  const prompt =
    "Você é um nutricionista esportivo especializado em estimativa de macros. O usuário vai descrever, " +
    "em português do Brasil, tudo que comeu em uma única refeição, podendo ter vários alimentos. Separe a " +
    "descrição em itens individuais. Para cada item, estime a quantidade em GRAMAS da porção (peso da " +
    "porção descrita, ex: '176 gramas de sobrecoxa assada' -> grams=176; se a porção não tiver peso " +
    "explícito, estime um peso razoável a partir de medidas caseiras) e as informações nutricionais TOTAIS " +
    "para essa quantidade (não por 100g), baseadas em tabelas nutricionais reais (TACO/USDA).\n\n" +
    "Refeição descrita: " +
    descricao;

  let geminiRes: Response;
  try {
    geminiRes = await callGemini({ apiKey: geminiKey, prompt, responseSchema: ITEMS_SCHEMA });
  } catch (err) {
    console.error("describe-meal: falha ao chamar o Gemini", err);
    return errorResponse("upstream_error", "Não foi possível consultar a IA agora.", 502);
  }

  if (geminiRes.status === 429) {
    return errorResponse("rate_limited", "Muitas solicitações — aguarde um instante.", 429);
  }
  if (!geminiRes.ok) {
    console.error("describe-meal: Gemini respondeu", geminiRes.status, await geminiRes.text());
    return errorResponse("upstream_error", "A IA não respondeu corretamente.", 502);
  }

  const text = extractGeminiText(await geminiRes.json());
  let items: unknown;
  try {
    items = JSON.parse(text);
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

  // Só debita o contador diário do Free depois de uma resposta boa da IA —
  // falha da IA não deve custar nada ao usuário. Consumo atômico (trava a
  // linha, confere de novo o contador) pra nunca passar do limite mesmo com
  // duas chamadas simultâneas. Pro não tem contador nenhum pra debitar.
  if (profileRow.role === "free") {
    const { data: consumed, error: consumeError } = await supabaseClient.rpc("consumir_estimativa_ia_free");
    if (consumeError || !consumed) {
      return errorResponse("limit_reached", FREE_LIMIT_MESSAGE, 403);
    }
  }

  return jsonResponse({ items: clean });
});
