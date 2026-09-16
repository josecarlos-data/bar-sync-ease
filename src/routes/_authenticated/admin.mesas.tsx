import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, Plus } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import type { BarTable } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas y QR — Comandas de bar" },
      { name: "description", content: "Crea mesas y descarga su código QR." },
    ],
  }),
  component: TablesPage,
});

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

function TablesPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const queryClient = useQueryClient();

  const { data: tables = [] } = useQuery({
    queryKey: ["admin-mesas", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tables")
        .select("*")
        .eq("bar_id", barId!)
        .order("number");
      return (data ?? []) as BarTable[];
    },
  });

  async function addTable() {
    const next = (tables.at(-1)?.number ?? 0) + 1;
    const { error } = await supabase
      .from("tables")
      .insert({ bar_id: barId!, number: next, qr_token: randomToken(), active: true });
    if (error) return toast.error("No se pudo crear la mesa");
    queryClient.invalidateQueries();
  }

  async function regenerate(table: BarTable) {
    const { error } = await supabase
      .from("tables")
      .update({ qr_token: randomToken() })
      .eq("id", table.id);
    if (error) return toast.error("No se pudo renovar el código");
    toast.success("Código renovado: imprime el QR nuevo");
    queryClient.invalidateQueries();
  }

  return (
    <StaffShell title="Mesas y QR">
      <button
        onClick={addTable}
        className="mb-4 flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> Añadir mesa
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} onRegenerate={() => regenerate(table)} />
        ))}
      </div>
    </StaffShell>
  );
}

function TableCard({ table, onRegenerate }: { table: BarTable; onRegenerate: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url =
    typeof window === "undefined" ? "" : `${window.location.origin}/m/${table.qr_token}`;

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 512, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [url]);

  return (
    <article className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="font-display text-2xl font-extrabold">Mesa {table.number}</p>
      {dataUrl && (
        <img src={dataUrl} alt={`Código QR de la mesa ${table.number}`} className="mx-auto w-40" />
      )}
      <div className="mt-2 flex justify-center gap-2">
        {dataUrl && (
          <a
            href={dataUrl}
            download={`mesa-${table.number}.png`}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> Descargar
          </a>
        )}
        <button
          onClick={onRegenerate}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Renovar
        </button>
      </div>
    </article>
  );
}
