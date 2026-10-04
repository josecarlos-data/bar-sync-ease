import { formatEUR } from "@/lib/allergens";
import { printHtml } from "@/lib/ticket";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type TabInvoiceRow = {
  id: string;
  series: string;
  number: number;
  total: number;
  created_at: string;
  snapshot: {
    bar: {
      name: string;
      legal_name: string | null;
      tax_id: string | null;
      address: string | null;
      phone: string | null;
      footer: string | null;
    };
    tab: { name: string; phone: string; note: string; opened_at: string | null };
    method: string;
    lines: { name: string; price: number; tax_rate: number; qty: number; total: number }[];
    breakdown: { rate: number; base: number; tax: number; total: number }[];
  };
};

export const tabInvoiceCode = (i: Pick<TabInvoiceRow, "series" | "number">) =>
  `${i.series}-${String(i.number).padStart(5, "0")}`;

const METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  bizum: "Bizum",
  "": "—",
};

export function tabTicketHtml(i: TabInvoiceRow) {
  const s = i.snapshot;
  const b = s.bar;
  return `<div class="c"><h2>${esc(b.legal_name || b.name)}</h2>
    ${b.tax_id ? `<div>NIF ${esc(b.tax_id)}</div>` : ""}
    ${b.address ? `<div>${esc(b.address)}</div>` : ""}
    ${b.phone ? `<div>Tel. ${esc(b.phone)}</div>` : ""}</div><hr>
    <div class="b">CUENTA DE FIADO ${tabInvoiceCode(i)}</div>
    <div>${esc(s.tab.name)}${s.tab.phone ? ` · ${esc(s.tab.phone)}` : ""}</div>
    <div>${new Date(i.created_at).toLocaleString("es-ES")}</div><hr>
    <table>${s.lines
      .map((l) => `<tr><td>${l.qty} ${esc(l.name)}</td><td class="r">${formatEUR(l.total)}</td></tr>`)
      .join("")}</table><hr>
    <table><tr><td>IVA</td><td class="r">Base</td><td class="r">Cuota</td></tr>${s.breakdown
      .map((x) => `<tr><td>${x.rate}%</td><td class="r">${formatEUR(x.base)}</td><td class="r">${formatEUR(x.tax)}</td></tr>`)
      .join("")}</table><hr>
    <table><tr><td class="big">TOTAL</td><td class="r big">${formatEUR(i.total)}</td></tr></table>
    <div>Pagado con: ${esc(METHOD_LABEL[s.method] ?? s.method)}</div>
    ${s.tab.note ? `<div class="note">${esc(s.tab.note)}</div>` : ""}
    <div class="c" style="margin-top:6px">${esc(b.footer || "¡Gracias por su visita!")}</div>`;
}

export async function downloadTabInvoicePdf(i: TabInvoiceRow) {
  const { jsPDF } = await import("jspdf");
  const s = i.snapshot;
  const pdf = new jsPDF({ unit: "mm", format: "a5" });
  let y = 14;
  const line = (text: string, opts: { bold?: boolean; size?: number; right?: string } = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size ?? 10);
    pdf.text(text, 12, y);
    if (opts.right) pdf.text(opts.right, 136, y, { align: "right" });
    y += (opts.size ?? 10) * 0.5;
    if (y > 195) { pdf.addPage(); y = 14; }
  };
  const rule = () => { pdf.setLineWidth(0.2); pdf.line(12, y - 2, 136, y - 2); y += 2; };

  line(s.bar.legal_name || s.bar.name, { bold: true, size: 14 });
  if (s.bar.tax_id) line(`NIF ${s.bar.tax_id}`);
  if (s.bar.address) line(s.bar.address);
  if (s.bar.phone) line(`Tel. ${s.bar.phone}`);
  y += 2; rule();
  line(`CUENTA DE FIADO ${tabInvoiceCode(i)}`, { bold: true, size: 12 });
  line(s.tab.name + (s.tab.phone ? ` · ${s.tab.phone}` : ""));
  line(new Date(i.created_at).toLocaleString("es-ES"));
  y += 2; rule();
  for (const l of s.lines) line(`${l.qty} x ${l.name}  (${formatEUR(l.price)})`, { right: formatEUR(l.total) });
  y += 2; rule();
  for (const b of s.breakdown) line(`IVA ${b.rate}%  Base ${formatEUR(b.base)}`, { right: `Cuota ${formatEUR(b.tax)}` });
  y += 2; rule();
  line("TOTAL", { bold: true, size: 14, right: formatEUR(i.total) });
  line(`Pagado con: ${METHOD_LABEL[s.method] ?? s.method}`);
  if (s.tab.note) line(s.tab.note);
  y += 4;
  line(s.bar.footer || "¡Gracias por su visita!");
  pdf.save(`fiado-${tabInvoiceCode(i)}.pdf`);
}

/** Total y IVA de las líneas apuntadas, para la pantalla de fiado. */
export function tabTotals(lines: { price_snapshot: number; tax_rate_snapshot: number; qty: number }[]) {
  const byRate = new Map<number, number>();
  let total = 0;
  for (const l of lines) {
    const sub = Number(l.price_snapshot) * l.qty;
    total += sub;
    byRate.set(Number(l.tax_rate_snapshot), (byRate.get(Number(l.tax_rate_snapshot)) ?? 0) + sub);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const breakdown = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, gross]) => {
    const base = r2(gross / (1 + rate / 100));
    return { rate, base, tax: r2(gross - base) };
  });
  return { total: r2(total), breakdown };
}
