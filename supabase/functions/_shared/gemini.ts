// Helper compartilhado pelas Edge Functions que usam o Gemini como IA
// principal (describe-meal, chat-assistant, transcribe-audio). Centraliza a
// chamada HTTP e o uso de responseSchema — o Gemini valida e força o
// formato JSON de saída no próprio servidor dele, então não precisamos mais
// caçar o JSON dentro do texto com regex (como era preciso com o Claude).

// "-latest" em vez de fixar uma versão: o Google descontinua modelos do
// Gemini com frequência (ex: gemini-2.0-flash parou de responder — a API
// devolve 404 pedindo pra trocar de modelo), e usar o apelido evita ter que
// vir atualizar isso aqui toda vez.
export const GEMINI_MODEL = "gemini-flash-latest";

export interface GeminiCallOptions {
  apiKey: string;
  prompt: string;
  parts?: unknown[];
  responseSchema?: unknown;
  temperature?: number;
  /** Gasta tokens "pensando" antes de responder — mais lento e mais caro.
   * Nas tarefas daqui (extrair JSON, responder um chat) isso não melhora o
   * resultado o bastante pra valer a latência extra, então some por padrão. */
  thinking?: boolean;
}

// Só nos 503 ("model overloaded/high demand") — instabilidade temporária do
// lado do Google, não um erro da nossa chamada. 429 (limite de uso) e outros
// erros não são re-tentados aqui: já têm tratamento específico em quem chama.
const OVERLOAD_RETRY_DELAYS_MS = [800, 1600];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(opts: GeminiCallOptions): Promise<Response> {
  const parts: unknown[] = [{ text: opts.prompt }, ...(opts.parts || [])];
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.2,
    thinkingConfig: { thinkingBudget: opts.thinking ? -1 : 0 },
  };
  if (opts.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = opts.responseSchema;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${opts.apiKey}`;
  const body = JSON.stringify({ contents: [{ parts }], generationConfig });

  let res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  for (const delay of OVERLOAD_RETRY_DELAYS_MS) {
    if (res.status !== 503) break;
    await sleep(delay);
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
  }
  return res;
}

export function extractGeminiText(geminiJson: any): string {
  return ((geminiJson?.candidates?.[0]?.content?.parts || []) as { text?: string }[])
    .map((part) => part?.text || "")
    .join("")
    .trim();
}
