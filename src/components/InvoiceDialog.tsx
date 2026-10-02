import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Printer, FileText, X, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/allergens";
import { downloadInvoicePdf, invoiceCode, invoiceHtml, printHtml, type InvoiceRow } from "@/lib/ticket";

type Part = { id: string; label: string; amount: number };

export function InvoiceDialog({
  sessionId,
  staff,
  onClose,
}: {
  sessionId: string;
  staff: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fullFor, setFullFor] = useState<string | null | undefined>(undefined); // part id, null = whole bill
  const [cust, setCust] = useState({ name: "", taxId: "", address: "" });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", sessionId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("session_id", sessionId).order("created_at");
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["invoice-parts", sessionId],
    queryFn: async () => {
      const { data: split } = await supabase.from("bill_splits").select("id").eq("session_id", sessionId).maybeSingle();
      if (!split) return [] as Part[];
      const { data } = await supabase.from("bill_split_parts").select("id, label, amount").eq("split_id", split.id).order("position");
      return (data ?? []) as Part[];
    },
  });
  const { data: width = 80 } = useQuery({
    queryKey: ["printer-width", sessionId],
    queryFn: async () => {
      const { data: s } = await supabase.from("table_sessions").select("bar_id").eq("id", sessionId).single();
      const { data } = await supabase.from("bar_settings").select("printer_width").eq("bar_id", s!.bar_id).single();
      return data?.printer_width ?? 80;
    },
  });

  async function issue(partId: string | null, full = false): Promise<InvoiceRow | null> {
    setBusy(true);
    const args: { _session_id: string; _split_part_id?: string; _kind: string; _customer_name?: string; _customer_tax_id?: string; _customer_address?: string } = {
      _session_id: sessionId,
      _kind: full ? "full" : "simplified",
    };
    if (partId) args._split_part_id = partId;
    if (full) {
      args._customer_name = cust.name;
      args._customer_tax_id = cust.taxId;
      if (cust.address) args._customer_address = cust.address;
    }
    const { data: id, error } = await supabase.rpc("issue_invoice", args);
    if (error || !id) { setBusy(false); toast.error("No se pudo generar el ticket"); return null; }
    const { data } = await supabase.from("invoices").select("*").eq("id", id).single();
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["invoices", sessionId] });
    return data as unknown as InvoiceRow;
  }

  const targets: { id: string | null; label: string; amount?: number }[] =
    parts.length > 0 ? parts.map((p) => ({ id: p.id, label: `Parte ${p.label}`, amount: p.amount })) : [{ id: null, label: "Cuenta completa" }];

  async function act(partId: string | null, what: "print" | "pdf") {
    const inv = await issue(partId);
    if (!inv) return;
    if (what === "print") printHtml(invoiceHtml(inv), width);
    else await downloadInvoicePdf(inv);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Ticket / factura</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-2">
          {targets.map((t) => (
            <div key={t.id ?? "all"} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex justify-between font-semibold">
                <span>{t.label}</span>
                {t.amount != null && <span className="tabular">{formatEUR(t.amount)}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {staff && (
                  <Button size="sm" disabled={busy} onClick={() => act(t.id, "print")}>
                    <Printer className="h-4 w-4" /> Imprimir ticket
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(t.id, "pdf")}>
                  <Download className="h-4 w-4" /> Descargar PDF
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setFullFor(t.id)}>
                  <FileText className="h-4 w-4" /> Factura con datos
                </Button>
                <Button size="sm" variant="outline" disabled title="Configura el correo del negocio para activar el envío">
                  <Mail className="h-4 w-4" /> Enviar por email
                </Button>
              </div>
            </div>
          ))}
        </div>

        {fullFor !== undefined && (
          <div className="mt-3 space-y-2 rounded-xl border border-primary p-3">
            <p className="font-semibold">Datos para la factura</p>
            <Input placeholder="Nombre o razón social" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            <Input placeholder="NIF / CIF" value={cust.taxId} onChange={(e) => setCust({ ...cust, taxId: e.target.value })} />
            <Input placeholder="Dirección (opcional)" value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !cust.name.trim() || !cust.taxId.trim()}
                onClick={async () => {
                  const inv = await issue(fullFor, true);
                  if (!inv) return;
                  setFullFor(undefined);
                  if (staff) printHtml(invoiceHtml(inv), width);
                  else await downloadInvoicePdf(inv);
                }}
              >
                Emitir factura
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFullFor(undefined)}>Cancelar</Button>
            </div>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Emitidos</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1">
                    <span className="font-semibold">{invoiceCode(i)}</span>{" "}
                    {i.kind === "full" ? `· ${i.customer_name}` : ""}
                    {i.snapshot.part_label ? ` · Parte ${i.snapshot.part_label}` : ""}
                  </span>
                  <span className="tabular">{formatEUR(i.total)}</span>
                  {staff && (
                    <button aria-label="Imprimir" onClick={() => printHtml(invoiceHtml(i), width)}><Printer className="h-4 w-4" /></button>
                  )}
                  <button aria-label="Descargar PDF" onClick={() => downloadInvoicePdf(i)}><Download className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
