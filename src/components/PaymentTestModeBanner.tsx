const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"];

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        El pago con tarjeta aún no está listo para cobros reales.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning-foreground">
        Los pagos con tarjeta están en modo de pruebas: no se cobra dinero real.
      </div>
    );
  }
  return null;
}
