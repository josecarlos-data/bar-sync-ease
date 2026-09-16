import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Utensils, Beer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comandas de bar — pedidos por QR en la mesa" },
      {
        name: "description",
        content:
          "Gestiona los pedidos del bar: los clientes piden con el QR de la mesa y barra y cocina reciben las comandas al instante.",
      },
      { property: "og:title", content: "Comandas de bar — pedidos por QR en la mesa" },
      {
        property: "og:description",
        content: "Pedidos por QR, comandas en tiempo real para barra y cocina, y cuenta de la mesa.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 py-14">
        <p className="font-display text-xs font-bold tracking-[0.2em] text-primary uppercase">
          Comandas de bar
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-bold">
          Pedidos de mesa, sin esperas y sin errores
        </h1>
        <p className="mt-3 text-muted-foreground">
          El cliente escanea el QR de su mesa y pide. Barra y cocina lo ven al momento.
        </p>

        <div className="mt-8 space-y-3">
          <Feature icon={<QrCode className="h-5 w-5" />} title="El cliente pide desde su móvil">
            Sin descargar nada y sin registrarse.
          </Feature>
          <Feature icon={<Beer className="h-5 w-5" />} title="Barra y cocina en tiempo real">
            Cada línea llega a su sitio, con mesa, cantidad y nota.
          </Feature>
          <Feature icon={<Utensils className="h-5 w-5" />} title="La cuenta siempre al día">
            Total de la mesa detallado por comandas y artículos.
          </Feature>
        </div>

        <Link
          to="/auth"
          className="mt-10 flex h-14 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground"
        >
          Acceso del personal
        </Link>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
