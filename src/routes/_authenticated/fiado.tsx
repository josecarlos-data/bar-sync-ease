import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Printer, Plus, Receipt, Trash2, X } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { TabLineDialog } from "@/components/TabLineDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useBarSettings, useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { formatEUR } from "@/lib/allergens";
import { downloadTabInvoicePdf, tabInvoiceCode, tabTicketHtml, tabTotals, type TabInvoiceRow } from "@/lib/tab";
import { printHtml } from "@/lib/ticket";

export const Route = createFileRoute("/_authenticated/fiado")({
  head: () => ({
    meta: [
      { title: "Cuentas de fiado — Comandas de bar" },
      { name: "description", content: "Apuntar consumiciones por nombre y pasar la cuenta cuando toque." },
      { property: "og:title", content: "Cuentas de fiado — Comandas de bar" },
      { property: "og:description", content: "Fiado por nombre, con ticket e IVA desglosado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FiadoPage,
});

type Tab = {
  id: string;
  bar_id: string;
  name: string;
  phone: string;
  note: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  paid_method: string;
};
type TabLine = {
  id: string;
  tab_id: string;
  name_snapshot: string;
  price_snapshot: number;
  tax_rate_snapshot: number;
  qty: number;
  created_at: string;
};

function FiadoPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [linesFor, setLinesFor] = useState<Tab | null>(null);
  const [closeFor, setCloseFor] = useState<Tab | null>(null);
  const [detailFor, setDetailFor] = useState<Tab | null>(null);

  useRealtime("fiado", ["customer_tabs", "customer_tab_lines"], !!barId && settings?.tabs_enabled !== false);

  const { data } = useQuery({
    queryKey: ["fiado", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [open, closed] = await Promise.all([
        supabase.from("customer_tabs").select("*").eq("bar_id", barId!).eq("status", "open").order("opened_at"),
        supabase.from("customer_tabs").select("*").eq("bar_id", barId!).eq("status", "closed").order("closed_at", { ascending: false }).limit(12),
      ]);
      const tabs = (open.data ?? []) as Tab[];
      const history = (closed.data ?? []) as Tab[];
      const ids = [...tabs, ...history].map((t) => t.id);
      const lines = ids.length
        ? ((await supabase.from("customer_tab_lines").select("*").eq("bar_id", barId!).in("tab_id", ids).order("created_at")).data ?? []) as TabLine[]
        : [];
      const invoices = ids.length
        ? ((await supabase.from("customer_tab_invoices").select("*").eq("bar_id", barId!).in("tab_id", ids).order("created_at")).data ?? []) as unknown as (TabInvoiceRow & { tab_id: string })[]
        : [];
      return { tabs, history, lines, invoices };
    },
  });

  async function create() {
    const clean = name.trim();
    if (!clean) { toast.error("Pon un nombre para la cuenta"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("customer_tabs")
      .insert({ bar_id: barId!, name: clean, phone: phone.trim(), created_by: staff?.userId ?? null });
    setBusy(false);
    if (error) { toast.error("No se pudo abrir la cuenta"); return; }
    setName("");
    setPhone("");
    qc.invalidateQueries();
    toast.success(`Cuenta abierta: ${clean}`);
  }

  if (!settings?.tabs_enabled) {
    return (
      <StaffShell title="Cuentas de fiado">
        <div className="rounded-xl border border-dashed bg-card p-6 text-center">
          <p className="font-semibold">El fiado está apagado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enciéndelo en Ajustes → Funciones para apuntar consumiciones por nombre y pasar la cuenta luego.
          </p>
          <Button asChild className="mt-4">
            <Link to="/admin/ajustes">Ir a Ajustes</Link>
          </Button>
        </div>
      </StaffShell>
    );
  }

  const tabs = data?.tabs ?? [];
  const history = data?.history ?? [];
  const lines = data?.lines ?? [];

  return (
    <StaffShell title="Cuentas de fiado">
      {linesFor && barId && staff?.userId && (
        <TabLineDialog
          barId={barId}
          tabId={linesFor.id}
          tabName={linesFor.name}
          userId={staff.userId}
          onClose={() => setLinesFor(null)}
        />
      )}
      {closeFor && <CloseTabDialog tab={closeFor} onClose={() => setCloseFor(null)} />}
      {detailFor && (
        <TabDetailDialog
          tab={detailFor}
          lines={lines.filter((l) => l.tab_id === detailFor.id)}
          onClose={() => setDetailFor(null)}
        />
      )}

      <form
        className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => { e.preventDefault(); void create(); }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre: Antonio el del taller…" maxLength={40} />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" maxLength={20} className="sm:w-40" />
        <Button type="submit" disabled={busy} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Abrir cuenta
        </Button>
      </form>

      {tabs.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          No hay cuentas abiertas. Abre una con el nombre del cliente y ve apuntando lo que tome.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tabs.map((t) => {
          const tl = lines.filter((l) => l.tab_id === t.id);
          const total = tabTotals(tl).total;
          return (
            <div key={t.id} className="rounded-xl border bg-card p-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="font-display text-lg font-extrabold">{t.name}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.opened_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
              {t.phone && <p className="text-sm text-muted-foreground">{t.phone}</p>}
              <p className="my-2 text-2xl font-bold">{formatEUR(total)}</p>
              {tl.length > 0 && (
                <ul className="mb-2 space-y-1 text-sm">
                  {tl.slice(-3).map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>{l.qty}× {l.name_snapshot}</span>
                      <span className="text-muted-foreground">{formatEUR(Number(l.price_snapshot) * l.qty)}</span>
                    </li>
                  ))}
                  {tl.length > 3 && <li className="text-xs text-muted-foreground">+{tl.length - 3} más</li>}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setLinesFor(t)}>
                  <Plus className="mr-1 h-4 w-4" /> Apuntar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDetailFor(t)}>
                  Ver todo ({tl.length})
                </Button>
                <Button size="sm" disabled={total <= 0} onClick={() => setCloseFor(t)}>
                  <Receipt className="mr-1 h-4 w-4" /> Pasar cuenta
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-bold">Cerradas recientemente</h2>
          <ul className="divide-y divide-border rounded-xl border bg-card">
            {history.map((t) => {
              const inv = data?.invoices.find((i) => i.tab_id === t.id);
              const total = inv ? Number(inv.total) : tabTotals(lines.filter((l) => l.tab_id === t.id)).total;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv ? tabInvoiceCode(inv) : "—"} · {t.closed_at ? new Date(t.closed_at).toLocaleDateString("es-ES") : ""}
                      {t.paid_method ? ` · ${t.paid_method}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{formatEUR(total)}</span>
                    {inv && (
                      <Button size="sm" variant="ghost" onClick={() => downloadTabInvoicePdf(inv)} aria-label={`Descargar ticket de ${t.name}`}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </StaffShell>
  );
}

/** Elige la forma de pago, cierra la cuenta y ofrece el ticket. */
function CloseTabDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("efectivo");
  const [invoice, setInvoice] = useState<TabInvoiceRow | null>(null);
  const { data: width = 80 } = useQuery({
    queryKey: ["tab-printer-width", tab.bar_id],
    queryFn: async () => {
      const { data } = await supabase.from("bar_settings").select("printer_width").eq("bar_id", tab.bar_id).maybeSingle();
      return data?.printer_width ?? 80;
    },
  });

  async function close(m: string) {
    setBusy(true);
    const { data: id, error } = await supabase.rpc("close_customer_tab", { _tab: tab.id, _method: m });
    if (error || !id) {
      setBusy(false);
      toast.error(error?.message.includes("empty") ? "La cuenta está vacía" : "No se pudo pasar la cuenta");
      return;
    }
    const { data } = await supabase.from("customer_tab_invoices").select("*").eq("id", id).single();
    setBusy(false);
    setInvoice(data as unknown as TabInvoiceRow);
    qc.invalidateQueries();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-card p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Pasar la cuenta</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{tab.name}</p>

        {!invoice ? (
          <div className="space-y-2">
            {["efectivo", "tarjeta", "bizum"].map((m) => (
              <Button key={m} className="w-full" variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>
                {m === "efectivo" ? "Efectivo" : m === "tarjeta" ? "Tarjeta" : "Bizum"}
              </Button>
            ))}
            <Button className="w-full" disabled={busy} onClick={() => close(method)}>
              <Check className="mr-1 h-4 w-4" /> {busy ? "Pasando…" : "Cobrar y cerrar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="rounded-lg bg-secondary p-3 text-sm">
              Ticket <b>{tabInvoiceCode(invoice)}</b> · {formatEUR(Number(invoice.total))}
            </p>
            <Button className="w-full" onClick={() => printHtml(tabTicketHtml(invoice), width)}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" className="w-full" onClick={() => downloadTabInvoicePdf(invoice)}>
              <Download className="mr-1 h-4 w-4" /> Descargar PDF
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Detalle de una cuenta: líneas y borrado de una línea equivocada. */
function TabDetailDialog({ tab, lines, onClose }: { tab: Tab; lines: TabLine[]; onClose: () => void }) {
  const qc = useQueryClient();
  const total = tabTotals(lines).total;

  async function remove(id: string) {
    const { error } = await supabase.from("customer_tab_lines").delete().eq("id", id);
    if (error) { toast.error("No se pudo quitar la línea"); return; }
    qc.invalidateQueries();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-card sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-xl font-bold">{tab.name}</h2>
            <p className="text-sm text-muted-foreground">{formatEUR(total)}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto p-2">
          {lines.length === 0 && <li className="p-4 text-center text-muted-foreground">Sin líneas todavía.</li>}
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 p-2">
              <div>
                <p className="font-semibold">{l.qty}× {l.name_snapshot}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatEUR(Number(l.price_snapshot) * l.qty)}</span>
                <Button size="icon" variant="ghost" onClick={() => remove(l.id)} aria-label={`Quitar ${l.name_snapshot}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
