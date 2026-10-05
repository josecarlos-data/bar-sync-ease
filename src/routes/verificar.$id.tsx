import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Receipt } from "lucide-react";
import { getInvoiceRecord } from "@/lib/verifactu.functions";
import { formatEUR } from "@/lib/allergens";

const recordQuery = (id: string) => ({
  queryKey: ["verify-invoice", id],
  queryFn: () => getInvoiceRecord({ data: { id } }),
});

export const Route = createFileRoute("/verificar/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(recordQuery(params.id)),
  head: () => ({
    meta: [
      { title: "Verificación de factura — VERI*FACTU" },
      { name: "description", content: "Comprueba la autenticidad de un ticket o factura emitida con registro de facturación verificable." },
      { property: "og:title", content: "Verificación de factura" },
      { property: "og:description", content: "Comprueba la autenticidad de un ticket o factura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }: { error: Error }) => (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">No se pudo comprobar el registro: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Registro no encontrado.</p>
    </div>
  ),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useParams();
  const { data: rec } = useSuspenseQuery(recordQuery(id));

  if (!rec) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="font-display text-xl font-bold">Registro no encontrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este código no corresponde a ningún registro de facturación. Comprueba que el QR del ticket es correcto.
        </p>
      </div>
    );
  }

  const code = `${rec.series}-${String(rec.number).padStart(5, "0")}`;
  const date = new Date(rec.issued_at).toLocaleString("es-ES");

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 pt-10 text-center">
        {rec.chainOk ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        ) : (
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
        )}
        <h1 className="font-display text-2xl font-bold">
          {rec.chainOk ? "Factura verificada" : "Cadena de registros alterada"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rec.chainOk
            ? "Este documento está registrado y su encadenamiento es íntegro."
            : "El registro existe pero no enlaza correctamente con el anterior. Consulta con el establecimiento."}
        </p>

        <div className="rounded-2xl border border-border bg-card p-4 text-left text-sm">
          <div className="mb-2 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{rec.kind === "full" ? "Factura" : "Factura simplificada"} {code}</span>
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-muted-foreground">Emisor</dt><dd className="font-medium">{rec.bar.name}</dd></div>
            {rec.bar.tax_id && <div className="flex justify-between"><dt className="text-muted-foreground">NIF</dt><dd>{rec.bar.tax_id}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Fecha</dt><dd>{date}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Importe total</dt><dd className="font-semibold tabular-nums">{formatEUR(rec.total)}</dd></div>
          </dl>
          <div className="mt-3 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">Huella del registro</p>
            <p className="font-mono text-[10px] break-all">{rec.hash}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Registro de facturación verificable — VERI*FACTU</p>
      </div>
    </div>
  );
}
