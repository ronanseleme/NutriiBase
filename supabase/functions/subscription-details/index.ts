// Supabase Edge Function: subscription-details
//
// Devolve os dados da assinatura recorrente do usuário logado (plano,
// próxima cobrança, forma de pagamento, últimas faturas) pra montar uma
// tela "Minha assinatura" dentro do próprio app — sem precisar mandar a
// pessoa pro Portal do Cliente hospedado pelo Stripe só pra ela ver isso.
//
// Deploy: supabase functions deploy subscription-details
// Secret: supabase secrets set STRIPE_SECRET_KEY=sk_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeGet, LICENSE_PRODUCTS } from "../_shared/stripe.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (req.method !== "GET") {
    return errorResponse("bad_request", "Use GET.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Faça login para ver sua assinatura.", 401);
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("upstream_error", "Configuração do servidor incompleta.", 500);
  }
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  const { data: profileRow } = await supabaseClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .single();
  if (!profileRow?.stripe_customer_id) {
    return errorResponse("no_subscription", "Você ainda não tem uma assinatura ativa.", 400);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return errorResponse("upstream_error", "Cobrança não configurada no servidor.", 500);
  }

  const subsRes = await stripeGet("subscriptions", stripeKey, {
    customer: profileRow.stripe_customer_id,
    status: "all",
    limit: 1,
    "expand[]": "data.default_payment_method",
  });
  if (!subsRes.ok) {
    console.error("subscription-details: Stripe respondeu", subsRes.status, await subsRes.text());
    return errorResponse("upstream_error", "Não foi possível carregar sua assinatura agora.", 502);
  }
  const subsJson = await subsRes.json();
  const sub = subsJson.data?.[0];
  if (!sub) {
    return errorResponse("no_subscription", "Nenhuma assinatura encontrada.", 400);
  }

  const item = sub.items?.data?.[0];
  const price = item?.price;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id;
  const planLabel = LICENSE_PRODUCTS.find((p) => p.id === productId)?.label ?? "Pro";

  const pm = sub.default_payment_method;
  const paymentMethod =
    pm && pm.card
      ? { brand: pm.card.brand as string, last4: pm.card.last4 as string, expMonth: pm.card.exp_month as number, expYear: pm.card.exp_year as number }
      : null;

  const invoicesRes = await stripeGet("invoices", stripeKey, {
    customer: profileRow.stripe_customer_id,
    limit: 10,
  });
  let invoices: unknown[] = [];
  if (invoicesRes.ok) {
    const invoicesJson = await invoicesRes.json();
    invoices = (invoicesJson.data ?? []).map((inv: Record<string, unknown>) => ({
      id: inv.id,
      date: new Date((inv.created as number) * 1000).toISOString(),
      amount: inv.amount_paid ?? inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));
  }

  return jsonResponse({
    status: sub.status,
    planLabel,
    amount: price?.unit_amount ?? null,
    currency: price?.currency ?? "brl",
    interval: price?.recurring?.interval ?? null,
    intervalCount: price?.recurring?.interval_count ?? null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    paymentMethod,
    invoices,
  });
});
