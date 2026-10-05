import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function handleCheckoutCompleted(session: any) {
  const partId = session.metadata?.split_part_id as string | undefined;
  if (!partId) return;
  if (session.payment_status === "unpaid") return; // métodos con liquidación diferida

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Importe vivo de la parte en el momento del cobro
  const { data: amountRaw } = await supabaseAdmin.rpc("bill_part_amount", { _part_id: partId });
  const amount = Number(amountRaw ?? 0);

  const { data: part } = await supabaseAdmin
    .from("bill_split_parts")
    .select("id, split_id, status")
    .eq("id", partId)
    .maybeSingle();
  if (!part || part.status === "paid") return; // idempotente

  await supabaseAdmin
    .from("bill_split_parts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "tarjeta",
      payment_ref: session.id,
      amount,
    })
    .eq("id", partId)
    .eq("status", "pending");

  // Emitir el ticket/factura de la parte, como en el cobro en mano
  const { data: split } = await supabaseAdmin
    .from("bill_splits")
    .select("session_id")
    .eq("id", part.split_id)
    .maybeSingle();
  if (split?.session_id) {
    await supabaseAdmin.rpc("issue_invoice", {
      _session_id: split.session_id,
      _split_part_id: partId,
      _kind: "ticket",
      _customer_name: undefined,
      _customer_tax_id: undefined,
      _customer_address: undefined,
    });
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
              await handleCheckoutCompleted(event.data.object);
              break;
            case "checkout.session.async_payment_succeeded":
              await handleCheckoutCompleted(event.data.object);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
