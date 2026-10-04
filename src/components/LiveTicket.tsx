import { tableLabel, displayNickname } from "@/lib/tableLabel";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/allergens";
import type { BarSettings } from "@/lib/types";

export type TicketLine = { name: string; price: number; qty: number; taxRate: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function vatBreakdown(lines: TicketLine[]) {
  const map = new Map<number, number>();
  for (const l of lines) map.set(l.taxRate, (map.get(l.taxRate) ?? 0) + l.price * l.qty);
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, total]) => {
      const base = r2(total / (1 + rate / 100));
      return { rate, base, tax: r2(total - base), total: r2(total) };
    });
}

function group(lines: TicketLine[]) {
  const map = new Map<string, TicketLine>();
  for (const l of lines) {
    const k = `${l.name}|${l.price}|${l.taxRate}`;
    const e = map.get(k);
    if (e) e.qty += l.qty;
    else map.set(k, { ...l });
  }
  return [...map.values()];
}

export function LiveTicket({
  sessionId,
  barName,
  settings,
  tableNumber,
  nickname,
  lines,
}: {
  sessionId: string;
  barName: string;
  settings: BarSettings | null | undefined;
  tableNumber?: number | undefined;
  nickname?: string | null | undefined;
  lines: TicketLine[];
}) {
  const { data: parts = [] } = useQuery({
    queryKey: ["guest-bill-parts", sessionId],
    queryFn: async () => {
      const { data: split } = await supabase.from("bill_splits").select("id").eq("session_id", sessionId).maybeSingle();
      if (!split) return [];
      const { data } = await supabase.from("bill_split_parts").select("id, label, amount, status").eq("split_id", split.id).order("position");
      return data ?? [];
    },
  });

  const grouped = group(lines);
  const vat = vatBreakdown(lines);
  const total = r2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const now = new Date().toLocaleString("es-ES");
  const s = settings as (BarSettings & { legal_name?: string | null; tax_id?: string | null; address?: string | null }) | null | undefined;

  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 60 + grouped.length * 5 + vat.length * 5 + parts.length * 5] });
    let y = 8;
    const c = (t: string, size = 9, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size);
      doc.text(t, 40, y, { align: "center" });
      y += size * 0.5;
    };
    const row = (l: string, r: string) => {
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(l, 4, y);
      doc.text(r, 76, y, { align: "right" });
      y += 4.5;
    };
    c(s?.legal_name || barName, 11, true);
    if (s?.tax_id) c(`NIF ${s.tax_id}`, 8);
    if (s?.address) c(s.address, 8);
    c("TICKET PROVISIONAL - NO VÁLIDO COMO FACTURA", 8, true);
    c(`${tableLabel(tableNumber)}${displayNickname(nickname, tableNumber) ? ` · ${displayNickname(nickname, tableNumber)}` : ""} · ${now}`, 8);
    y += 2;
    grouped.forEach((l) => row(`${l.qty} x ${l.name}`.slice(0, 34), formatEUR(l.price * l.qty)));
    y += 2;
    vat.forEach((b) => row(`IVA ${b.rate}% base ${formatEUR(b.base)}`, `cuota ${formatEUR(b.tax)}`));
    doc.setFont("helvetica", "bold");
    row("TOTAL (IVA incluido)", formatEUR(total));
    if (s?.bizum_enabled && s?.bizum_phone) row("Paga con Bizum", s.bizum_phone);
    parts.forEach((p) => row(`Parte ${p.label}${p.status === "paid" ? " (pagada)" : ""}`, formatEUR(Number(p.amount))));
    doc.save(`ticket-provisional-mesa-${tableNumber ?? ""}.pdf`);
  }

  if (lines.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">Aún no hay nada en el ticket.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 font-mono text-sm">
        <div className="text-center">
          <p className="font-display text-base font-bold">{s?.legal_name || barName}</p>
          {s?.tax_id && <p className="text-xs">NIF {s.tax_id}</p>}
          {s?.address && <p className="text-xs">{s.address}</p>}
          <p className="mt-2 rounded bg-warning/20 px-2 py-1 text-xs font-bold">Ticket provisional — no válido como factura</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tableLabel(tableNumber)}{displayNickname(nickname, tableNumber) ? ` · ${displayNickname(nickname, tableNumber)}` : ""} · {now}
          </p>
        </div>
        <hr className="my-2 border-dashed border-border" />
        {grouped.map((l, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span>{l.qty} × {l.name} <span className="text-xs text-muted-foreground">({formatEUR(l.price)})</span></span>
            <span className="tabular">{formatEUR(l.price * l.qty)}</span>
          </div>
        ))}
        <hr className="my-2 border-dashed border-border" />
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">IVA</th><th className="text-right">Base</th><th className="text-right">Cuota</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {vat.map((b) => (
              <tr key={b.rate}><td>{b.rate}%</td><td className="text-right">{formatEUR(b.base)}</td><td className="text-right">{formatEUR(b.tax)}</td><td className="text-right">{formatEUR(b.total)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex justify-between text-base font-bold">
          <span>TOTAL <span className="text-xs font-normal">IVA incluido</span></span>
          <span className="tabular">{formatEUR(total)}</span>
        </div>
        {s?.bizum_enabled && s?.bizum_phone && (
          <p className="mt-2 rounded-lg bg-secondary px-2 py-1.5 text-center text-xs">
            ¿Pagas tú? Bizum <b>{s.bizum_phone}</b>{s.bizum_label ? ` · ${s.bizum_label}` : ""} · {formatEUR(total)}
          </p>
        )}
        {parts.length > 0 && (
          <>
            <hr className="my-2 border-dashed border-border" />
            {parts.map((p) => (
              <div key={p.id} className="flex justify-between text-xs">
                <span>Parte {p.label}{p.status === "paid" ? " · pagada" : ""}</span>
                <span className="tabular">{formatEUR(Number(p.amount))}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <Button variant="outline" className="w-full" onClick={pdf}>
        <Download className="h-4 w-4" /> Descargar PDF (provisional)
      </Button>
    </div>
  );
}
