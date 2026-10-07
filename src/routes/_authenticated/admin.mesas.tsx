import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileDown, ImageDown, Plus } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBarSettings, useStaff } from "@/hooks/useStaff";
import {
  createTableLabelDataUrl,
  downloadDataUrl,
  TABLE_LABEL_HEIGHT_MM,
  TABLE_LABEL_WIDTH_MM,
} from "@/lib/table-label";
import type { BarTable } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas y QR — Comandas de bar" },
      { name: "description", content: "Crea mesas y descarga su código QR." },
      { property: "og:title", content: "Mesas y QR — Comandas de bar" },
      { property: "og:description", content: "Crea mesas y descarga sus etiquetas QR imprimibles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { data: settings } = useBarSettings(barId);
  const queryClient = useQueryClient();
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: tables = [] } = useQuery({
    queryKey: ["admin-mesas", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tables")
        .select("*")
        .eq("bar_id", barId ?? "")
        .eq("kind", "table")
        .order("number");
      return (data ?? []) as BarTable[];
    },
  });

  async function addTable() {
    if (!barId) return;
    const next = (tables.at(-1)?.number ?? 0) + 1;
    const { error } = await supabase
      .from("tables")
      .insert({ bar_id: barId, number: next, qr_token: randomToken(), active: true });
    if (error) { toast.error("No se pudo crear la mesa"); return; }
    queryClient.invalidateQueries();
  }

  async function regenerate(table: BarTable) {
    const { error } = await supabase
      .from("tables")
      .update({ qr_token: randomToken() })
      .eq("id", table.id);
    if (error) { toast.error("No se pudo renovar el código"); return; }
    toast.success("Código renovado: imprime el QR nuevo");
    queryClient.invalidateQueries();
  }

  const base = settings?.public_base_url || (typeof window === "undefined" ? "" : window.location.origin);
  const isPrivate = /id-preview--|preview--|lovableproject\.com|localhost/.test(base);

  async function downloadAllLabels() {
    if (!base || tables.length === 0) return;
    setDownloadingAll(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = 210;
      const pageHeight = 297;
      const left = (pageWidth - TABLE_LABEL_WIDTH_MM * 3) / 2;
      const top = (pageHeight - TABLE_LABEL_HEIGHT_MM * 3) / 2;

      for (let index = 0; index < tables.length; index += 1) {
        if (index > 0 && index % 9 === 0) pdf.addPage("a4", "portrait");
        const slot = index % 9;
        const x = left + (slot % 3) * TABLE_LABEL_WIDTH_MM;
        const y = top + Math.floor(slot / 3) * TABLE_LABEL_HEIGHT_MM;
        const table = tables[index];
        if (!table) continue;
        const dataUrl = await createTableLabelDataUrl(table.number, `${base}/m/${table.qr_token}`);
        pdf.addImage(dataUrl, "PNG", x, y, TABLE_LABEL_WIDTH_MM, TABLE_LABEL_HEIGHT_MM, undefined, "FAST");
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.15);
        pdf.rect(x, y, TABLE_LABEL_WIDTH_MM, TABLE_LABEL_HEIGHT_MM);
      }
      pdf.save("etiquetas-mesas.pdf");
    } catch {
      toast.error("No se pudo crear el PDF de etiquetas");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <StaffShell title="Mesas y QR">
      {isPrivate && (
        <div className="mb-4 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-semibold">Estos QR no funcionarán con clientes.</p>
          <p>Apuntan a la vista previa privada. Publica la app y escribe su dirección en Ajustes → «Dirección pública de la carta».</p>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={addTable}>
          <Plus /> Añadir mesa
        </Button>
        <Button variant="outline" onClick={downloadAllLabels} disabled={!base || tables.length === 0 || downloadingAll}>
          <FileDown /> {downloadingAll ? "Preparando PDF…" : "Descargar todas en PDF"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} base={base} onRegenerate={() => regenerate(table)} />
        ))}
      </div>
    </StaffShell>
  );
}

function TableCard({ table, base, onRegenerate }: { table: BarTable; base: string; onRegenerate: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const url = base ? `${base}/m/${table.qr_token}` : "";

  useEffect(() => {
    let cancelled = false;
    if (!url) { setDataUrl(null); return; }
    void createTableLabelDataUrl(table.number, url)
      .then((result) => { if (!cancelled) setDataUrl(result); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [table.number, url]);

  async function downloadPdf() {
    if (!dataUrl) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: [TABLE_LABEL_WIDTH_MM, TABLE_LABEL_HEIGHT_MM], orientation: "portrait" });
      pdf.addImage(dataUrl, "PNG", 0, 0, TABLE_LABEL_WIDTH_MM, TABLE_LABEL_HEIGHT_MM, undefined, "FAST");
      pdf.save(`mesa-${table.number}.pdf`);
    } catch {
      toast.error("No se pudo crear el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="font-display text-2xl font-extrabold">Mesa {table.number}</p>
      {dataUrl && (
        <img src={dataUrl} alt={`Etiqueta QR de la mesa ${table.number}`} className="mx-auto my-3 w-40 border border-border" />
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {dataUrl && (
          <Button variant="outline" size="sm" onClick={() => downloadDataUrl(dataUrl, `mesa-${table.number}.png`)}>
            <ImageDown /> PNG
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={downloadPdf} disabled={!dataUrl || downloadingPdf}>
          <Download /> {downloadingPdf ? "Creando…" : "PDF"}
        </Button>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          Renovar
        </Button>
      </div>
    </article>
  );
}
