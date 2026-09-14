// Supabase Edge Function: stripe-webhook
//
// O Stripe chama essa função sozinho (sem login de usuário nenhum) quando
// algo muda numa assinatura. Verifica a assinatura HMAC do corpo pra
// confirmar que a requisição realmente veio do Stripe, e então usa a
// Service Role Key (auto-injetada em toda Edge Function pelo Supabase, não
// precisa configurar) pra chamar stripe_activate_pro/stripe_deactivate_pro.
//
// Depois do deploy, cadastre esta URL no Stripe Dashboard → Developers →
// Webhooks → Add endpoint:
//   https://<seu-projeto>.supabase.co/functions/v1/stripe-webhook
// Eventos a assinar: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_...
//          supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyStripeSignature } from "../_shared/stripe.ts";

const INACTIVE_SUBSCRIPTION_STATUSES = ["canceled", "unpaid", "incomplete_expired", "paused"];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Use POST.", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET não está configurada nas secrets da função");
    return new Response("Webhook não configurado.", { status: 500 });
  }

  const rawBody = await req.text();
  const signatureOk = await verifyStripeSignature(rawBody, req.headers.get("Stripe-Signature"), webhookSecret);
  if (!signatureOk) {
    console.error("stripe-webhook: assinatura inválida");
    return new Response("Assinatura inválida.", { status: 400 });
  }

  let event: { type: string; data: { object: any } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("JSON inválido.", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("stripe-webhook: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes (deveriam ser automáticas)");
    return new Response("Configuração incompleta.", { status: 500 });
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id as string | null;
      const customerId = session.customer as string | null;
      if (session.mode === "subscription" && userId && customerId) {
        const { error } = await supabaseAdmin.rpc("stripe_activate_pro", {
          target_user: userId,
          p_stripe_customer_id: customerId,
        });
        if (error) console.error("stripe-webhook: stripe_activate_pro falhou", error);
      }
    } else if (event.type === "customer.subscription.deleted") {
      await deactivateByCustomer(supabaseAdmin, event.data.object.customer);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      if (INACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status)) {
        await deactivateByCustomer(supabaseAdmin, sub.customer);
      }
    }
  } catch (err) {
    console.error("stripe-webhook: erro processando evento", event.type, err);
    // Responde 200 mesmo assim — devolver erro faria o Stripe re-tentar
    // indefinidamente um evento que já sabemos que vai falhar de novo do
    // mesmo jeito (ex: usuário não existe mais). O log acima é o que importa.
  }

  return new Response("ok", { status: 200 });
});

async function deactivateByCustomer(supabaseAdmin: ReturnType<typeof createClient>, customerId: string | undefined) {
  if (!customerId) return;
  const { data: profileRow, error: findError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (findError || !profileRow) {
    console.error("stripe-webhook: nenhum profile com stripe_customer_id", customerId, findError);
    return;
  }
  const { error } = await supabaseAdmin.rpc("stripe_deactivate_pro", { target_user: profileRow.id });
  if (error) console.error("stripe-webhook: stripe_deactivate_pro falhou", error);
}
