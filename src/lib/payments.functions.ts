import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

// Crea una sesión de pago con tarjeta para una parte de una cuenta dividida.
// El importe se calcula en servidor (bill_part_amount); nunca se fía del cliente.
export const createBillCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { partId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.partId)) throw new Error("Invalid partId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid env");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: part } = await supabaseAdmin
        .from("bill_split_parts")
        .select("id, bar_id, split_id, label, status")
        .eq("id", data.partId)
        .maybeSingle();
      if (!part) return { error: "Parte no encontrada" };
      if (part.status === "paid") return { error: "Esta parte ya está pagada" };

      const { data: settings } = await supabaseAdmin
        .from("bar_settings")
        .select("payments_enabled")
        .eq("bar_id", part.bar_id)
        .maybeSingle();
      if (!settings?.payments_enabled) return { error: "El pago online no está activado en este bar" };

      const { data: amountRaw, error: amountErr } = await supabaseAdmin.rpc("bill_part_amount", {
        _part_id: part.id,
      });
      if (amountErr) return { error: amountErr.message };
      const amount = Number(amountRaw ?? 0);
      if (!(amount > 0)) return { error: "Esta parte no tiene importe pendiente" };

      const { data: split } = await supabaseAdmin
        .from("bill_splits")
        .select("session_id")
        .eq("id", part.split_id)
        .maybeSingle();

      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: `Cuenta — ${part.label}` },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: `Cuenta — ${part.label}` },
        metadata: {
          split_part_id: part.id,
          session_id: split?.session_id ?? "",
          bar_id: part.bar_id,
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
