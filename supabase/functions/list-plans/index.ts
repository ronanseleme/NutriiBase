// Supabase Edge Function: list-plans
//
// Devolve os planos Pro (nome, preço, intervalo) direto do Stripe, pros 4
// Produtos configurados no Dashboard — assim o app nunca mostra um preço
// desatualizado (se o valor mudar no Stripe, aparece certo aqui sem precisar
// mexer em código).
//
// Deploy: supabase functions deploy list-plans
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { stripeGet } from "../_shared/stripe.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

// Os 4 "produtos-licença" cadastrados no Stripe — id -> rótulo exibido.
const PRODUCTS: { id: string; label: string }[] = [
  { id: "prod_VG53dMDufAq4mz", label: "Mensal" },
  { id: "prod_VG57rA5pRCN02x", label: "Trimestral" },
  { id: "prod_VG5BIw7P5Rk4bB", label: "Semestral" },
  { id: "prod_VG5GcfW4tb9ARB", label: "Anual" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return errorResponse("upstream_error", "Cobrança não configurada no servidor.", 500);
  }

  const plans = await Promise.all(
    PRODUCTS.map(async ({ id, label }) => {
      try {
        const res = await stripeGet("prices", stripeKey, { product: id, active: "true", limit: "1" });
        if (!res.ok) return null;
        const json = await res.json();
        const price = json?.data?.[0];
        if (!price) return null;
        return {
          productId: id,
          priceId: price.id as string,
          label,
          unitAmount: price.unit_amount as number,
          currency: (price.currency as string).toUpperCase(),
          interval: price.recurring?.interval as string,
          intervalCount: price.recurring?.interval_count as number,
        };
      } catch {
        return null;
      }
    }),
  );

  return jsonResponse({ plans: plans.filter((p) => p !== null) });
});
