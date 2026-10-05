import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBillCheckout } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export function BillPartCheckout({ partId, onClose }: { partId: string; onClose: () => void }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createBillCheckout({
      data: {
        partId,
        returnUrl: window.location.href,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("No se pudo iniciar el pago");
    return result.clientSecret;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-semibold">Pagar con tarjeta</p>
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
        >
          Volver
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
