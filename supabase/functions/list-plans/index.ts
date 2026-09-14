// Supabase Edge Function: list-plans
//
// Devolve os planos Pro (nome, preço, intervalo) direto do Stripe, pros 4
// Produtos configurados no Dashboard — assim o app nunca mostra um preço
// desatualizado (se o valor mudar no Stripe, aparece certo aqui sem precisar
// mexer em código).
//
// Cada produto pode ter até 2 Preços ativos: um recorrente (assinatura via
// cartão) e um avulso/pagamento único (Pix — que não tem cobrança
// recorrente de verdade). Devolve os dois quando existirem; o frontend só
// mostra o botão de Pix se "oneTime" vier preenchido.
//
// Deploy: supabase functions deploy list-plans
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { stripeGet, LICENSE_PRODUCTS } from "../_shared/stripe.ts";

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

interface PriceInfo {
  priceId: string;
  unitAmount: number;
  currency: string;
}
interface RecurringPriceInfo extends PriceInfo {
  interval: string;
  intervalCount: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return errorResponse("upstream_error", "Cobrança não configurada no servidor.", 500);
  }

  const plans = await Promise.all(
    LICENSE_PRODUCTS.map(async ({ id, label, days }) => {
      try {
        const res = await stripeGet("prices", stripeKey, { product: id, active: "true", limit: "10" });
        if (!res.ok) return null;
        const json = await res.json();
        const prices: any[] = json?.data || [];
        if (!prices.length) return null;

        const recurringPrice = prices.find((p) => p.recurring);
        const oneTimePrice = prices.find((p) => !p.recurring);

        const recurring: RecurringPriceInfo | null = recurringPrice
          ? {
              priceId: recurringPrice.id,
              unitAmount: recurringPrice.unit_amount,
              currency: (recurringPrice.currency as string).toUpperCase(),
              interval: recurringPrice.recurring.interval,
              intervalCount: recurringPrice.recurring.interval_count,
            }
          : null;
        const oneTime: PriceInfo | null = oneTimePrice
          ? {
              priceId: oneTimePrice.id,
              unitAmount: oneTimePrice.unit_amount,
              currency: (oneTimePrice.currency as string).toUpperCase(),
            }
          : null;

        if (!recurring && !oneTime) return null;
        return { productId: id, label, days, recurring, oneTime };
      } catch {
        return null;
      }
    }),
  );

  return jsonResponse({ plans: plans.filter((p) => p !== null) });
});
