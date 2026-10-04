import { tableLabel } from "@/lib/tableLabel";
import { formatEUR } from "@/lib/allergens";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Prints HTML through a hidden iframe (silent in Chrome kiosk-printing mode). */
export function printHtml(body: string, widthMm = 80) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthMm}mm auto; margin: 3mm; }
    body { font-family: ui-monospace, Menlo, monospace; font-size: 12px; margin: 0; width: ${widthMm - 6}mm; color:#000 }
    h1 { font-size: 26px; margin: 0 } h2 { font-size: 14px; margin: 2px 0 }
    .c { text-align:center } .r { text-align:right } .b { font-weight:bold }
    .big { font-size: 18px; font-weight: bold } hr { border:0; border-top:1px dashed #000; margin:6px 0 }
    table { width:100%; border-collapse: collapse } td { vertical-align: top; padding: 1px 0 }
    .note { font-style: italic } .box { border: 2px solid #000; padding: 4px; font-weight: bold; white-space: pre-line }
  </style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60_000);
  }, 250);
}

export type KitchenTicket = {
  tableNumber: number | string;
  nickname: string | null;
  createdAt: string;
  lines: { qty: number; name: string; note: string | null }[];
  instructions: string[];
  label?: string;
};

export function kitchenTicketHtml(t: KitchenTicket) {
  const time = new Date(t.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `<div class="c"><h1>MESA ${esc(t.tableNumber)}</h1>${t.nickname ? `<h2>${esc(t.nickname)}</h2>` : ""}
    <div>${esc(t.label ?? "Comanda")} · ${time}</div></div><hr>
    ${t.instructions.map((i) => `<div class="box">${esc(i)}</div>`).join("")}
    <table>${t.lines
      .map(
        (l) => `<tr><td class="big" style="width:14mm">${l.qty}x</td><td class="big">${esc(l.name)}${
          l.note ? `<div class="note">“${esc(l.note)}”</div>` : ""
        }</td></tr>`,
      )
      .join("")}</table><hr>`;
}

export type InvoiceRow = {
  id: string;
  series: string;
  number: number;
  kind: "simplified" | "full";
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_address: string | null;
  total: number;
  created_at: string;
  snapshot: {
    bar: { name: string; legal_name: string | null; tax_id: string | null; address: string | null; phone: string | null; footer: string | null };
    table: { number: number; name: string | null; nickname: string | null };
    part_label: string | null;
    partial: boolean;
    lines: { name: string; price: number; tax_rate: number; qty: number; total: number }[];
    breakdown: { rate: number; base: number; tax: number; total: number }[];
  };
};

export const invoiceCode = (i: Pick<InvoiceRow, "series" | "number">) =>
  `${i.series}-${String(i.number).padStart(5, "0")}`;

export function invoiceHtml(i: InvoiceRow) {
  const s = i.snapshot;
  const date = new Date(i.created_at).toLocaleString("es-ES");
  return `<div class="c"><h2>${esc(s.bar.legal_name || s.bar.name)}</h2>
    ${s.bar.tax_id ? `<div>NIF ${esc(s.bar.tax_id)}</div>` : ""}
    ${s.bar.address ? `<div>${esc(s.bar.address)}</div>` : ""}
    ${s.bar.phone ? `<div>Tel. ${esc(s.bar.phone)}</div>` : ""}</div><hr>
    <div class="b">${i.kind === "full" ? "FACTURA" : "FACTURA SIMPLIFICADA"} ${invoiceCode(i)}</div>
    <div>${date} · ${esc(tableLabel(s.table.number))}${s.part_label ? ` · Parte ${esc(s.part_label)}` : ""}</div>
    ${i.kind === "full" ? `<hr><div>Cliente: ${esc(i.customer_name)}</div><div>NIF: ${esc(i.customer_tax_id)}</div>${i.customer_address ? `<div>${esc(i.customer_address)}</div>` : ""}` : ""}
    <hr><table>${s.lines
      .map((l) => `<tr><td>${l.qty} ${esc(l.name)}</td><td class="r">${formatEUR(l.total)}</td></tr>`)
      .join("")}</table>
    ${s.partial ? `<div class="note">Parte proporcional de la cuenta</div>` : ""}
    <hr><table><tr><td>IVA</td><td class="r">Base</td><td class="r">Cuota</td></tr>${s.breakdown
      .map((b) => `<tr><td>${b.rate}%</td><td class="r">${formatEUR(b.base)}</td><td class="r">${formatEUR(b.tax)}</td></tr>`)
      .join("")}</table><hr>
    <table><tr><td class="big">TOTAL</td><td class="r big">${formatEUR(i.total)}</td></tr></table>
    <div class="c" style="margin-top:6px">${esc(s.bar.footer || "¡Gracias por su visita!")}</div>`;
}

export async function downloadInvoicePdf(i: InvoiceRow) {
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
  line(`${i.kind === "full" ? "FACTURA" : "FACTURA SIMPLIFICADA"} ${invoiceCode(i)}`, { bold: true, size: 12 });
  line(`${new Date(i.created_at).toLocaleString("es-ES")} · ${tableLabel(s.table.number)}${s.part_label ? ` · Parte ${s.part_label}` : ""}`);
  if (i.kind === "full") {
    y += 2; rule();
    line(`Cliente: ${i.customer_name ?? ""}`);
    line(`NIF: ${i.customer_tax_id ?? ""}`);
    if (i.customer_address) line(i.customer_address);
  }
  y += 2; rule();
  for (const l of s.lines) line(`${l.qty} x ${l.name}  (${formatEUR(l.price)})`, { right: formatEUR(l.total) });
  if (s.partial) line("Parte proporcional de la cuenta");
  y += 2; rule();
  for (const b of s.breakdown) line(`IVA ${b.rate}%  Base ${formatEUR(b.base)}`, { right: `Cuota ${formatEUR(b.tax)}` });
  y += 2; rule();
  line("TOTAL", { bold: true, size: 14, right: formatEUR(i.total) });
  y += 4;
  line(s.bar.footer || "¡Gracias por su visita!");
  pdf.save(`ticket-${invoiceCode(i)}.pdf`);
}

export type ProvisionalTicket = {
  bar: InvoiceRow["snapshot"]["bar"];
  tableNumber: number;
  nickname: string | null;
  lines: { name: string; price: number; taxRate: number; qty: number }[];
};

/** Customer bill before payment (not an invoice), with VAT breakdown. */
export function provisionalTicketHtml(t: ProvisionalTicket) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const grouped = new Map<string, { name: string; price: number; qty: number; taxRate: number }>();
  for (const l of t.lines) {
    const k = `${l.name}|${l.price}|${l.taxRate}`;
    const g = grouped.get(k);
    if (g) g.qty += l.qty; else grouped.set(k, { ...l });
  }
  const byRate = new Map<number, number>();
  let total = 0;
  for (const l of grouped.values()) {
    const sub = l.price * l.qty;
    total += sub;
    byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + sub);
  }
  const breakdown = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, gross]) => {
    const base = r2(gross / (1 + rate / 100));
    return { rate, base, tax: r2(gross - base) };
  });
  const b = t.bar;
  return `<div class="c"><h2>${esc(b.legal_name || b.name)}</h2>
    ${b.tax_id ? `<div>NIF ${esc(b.tax_id)}</div>` : ""}
    ${b.address ? `<div>${esc(b.address)}</div>` : ""}
    ${b.phone ? `<div>Tel. ${esc(b.phone)}</div>` : ""}</div><hr>
    <div class="b">CUENTA — ${esc(tableLabel(t.tableNumber))}${t.nickname ? ` · ${esc(t.nickname)}` : ""}</div>
    <div>${new Date().toLocaleString("es-ES")}</div><hr>
    <table>${[...grouped.values()]
      .map((l) => `<tr><td>${l.qty} ${esc(l.name)}</td><td class="r">${formatEUR(l.price * l.qty)}</td></tr>`)
      .join("")}</table>
    <hr><table><tr><td>IVA</td><td class="r">Base</td><td class="r">Cuota</td></tr>${breakdown
      .map((x) => `<tr><td>${x.rate}%</td><td class="r">${formatEUR(x.base)}</td><td class="r">${formatEUR(x.tax)}</td></tr>`)
      .join("")}</table><hr>
    <table><tr><td class="big">TOTAL</td><td class="r big">${formatEUR(r2(total))}</td></tr></table>
    <div class="c note" style="margin-top:6px">Ticket provisional — no válido como factura</div>`;
}
