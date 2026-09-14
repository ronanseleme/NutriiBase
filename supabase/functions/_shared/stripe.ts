// Helper compartilhado pelas Edge Functions de cobrança (list-plans,
// create-checkout-session, create-portal-session, stripe-webhook). Chama a
// API REST do Stripe direto via fetch (sem o SDK oficial) — mesmo estilo
// minimalista já usado para Gemini em _shared/gemini.ts.

const STRIPE_API = "https://api.stripe.com/v1";

function toFormBody(params: Record<string, unknown>, prefix = ""): string[] {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      pairs.push(...toFormBody(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") {
          pairs.push(...toFormBody(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          pairs.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      pairs.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs;
}

export async function stripePost(path: string, secretKey: string, params: Record<string, unknown>): Promise<Response> {
  return await fetch(`${STRIPE_API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: toFormBody(params).join("&"),
  });
}

export async function stripeGet(path: string, secretKey: string, query: Record<string, unknown> = {}): Promise<Response> {
  const qs = toFormBody(query).join("&");
  return await fetch(`${STRIPE_API}/${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
  });
}

// Verifica a assinatura HMAC-SHA256 que o Stripe manda no header
// "Stripe-Signature" (formato "t=<timestamp>,v1=<hex>[,v0=...]"), contra o
// corpo BRUTO da requisição (precisa ser o texto exato recebido, antes de
// qualquer JSON.parse). Tolerância de 5 minutos contra replay.
export async function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
