import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ListChecks, Plus, Receipt } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { StaffOrderDialog } from "@/components/StaffOrderDialog";
import { TableOrdersDialog } from "@/components/TableOrdersDialog";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useBarSettings, useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { formatEUR } from "@/lib/allergens";
import { openCounterAccount } from "@/lib/bar.functions";

export const Route = createFileRoute("/_authenticated/de-pie")({
  head: () => ({
    meta: [
      { title: "Clientes de pie — Comandas de bar" },
      { name: "description", content: "Cuentas de barra sin mesa ni QR: apuntar, servir y cobrar." },
      { property: "og:title", content: "Clientes de pie — Comandas de bar" },
      { property: "og:description", content: "Cuentas de barra sin mesa ni QR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CounterPage,
});

type Account = {
  id: string;
  nickname: string | null;
  opened_at: string;
  table_id: string;
  tables: { number: number } | null;
};
type Line = {
  id: string;
  qty: number;
  price_snapshot: number;
  name_snapshot: string;
  status: string;
  orders: { session_id: string } | null;
};

function CounterPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  const qc = useQueryClient();
  const openAccount = useServerFn(openCounterAccount);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderFor, setOrderFor] = useState<{ tableId: string; tableNumber: number } | null>(null);
  const [detailFor, setDetailFor] = useState<Account | null>(null);
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const isAdmin = staff?.roles.includes("admin") ?? false;
  const canOrder = isAdmin || settings?.waiter_can_order !== false;

  useRealtime("counter", ["order_items", "orders", "table_sessions"], !!barId);

  const { data } = useQuery({
    queryKey: ["counter-accounts", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data: sess } = await supabase
        .from("table_sessions")
        .select("id, nickname, opened_at, table_id, tables!inner(number, kind)")
        .eq("bar_id", barId!)
        .eq("tables.kind", "counter")
        .in("status", ["pending", "open"])
        .order("opened_at");
      const accounts = (sess ?? []) as unknown as Account[];
      let lines: Line[] = [];
      if (accounts.length) {
        const { data: l } = await supabase
          .from("order_items")
          .select("id, qty, price_snapshot, name_snapshot, status, orders!inner(session_id)")
          .eq("bar_id", barId!)
          .is("deleted_at", null)
          .in("orders.session_id", accounts.map((a) => a.id));
        lines = (l ?? []) as unknown as Line[];
      }
      return { accounts, lines };
    },
  });

  async function create() {
    setBusy(true);
    try {
      const res = await openAccount({ data: { nickname: name } });
      setName("");
      qc.invalidateQueries();
      setOrderFor({ tableId: res.tableId, tableNumber: res.tableNumber });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir la cuenta");
    } finally {
      setBusy(false);
    }
  }

  async function serve(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("order_items")
      .update({ status: "served", served_at: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast.error("No se pudo servir"); return; }
    qc.invalidateQueries();
  }

  async function charge(a: Account, pending: string[]) {
    if (pending.length) await serve(pending);
    const { error } = await supabase
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: staff?.userId ?? null })
      .eq("id", a.id);
    if (error) { toast.error("No se pudo cobrar"); return; }
    toast.success(`Cobrada: ${a.nickname ?? "cuenta"}`);
    qc.invalidateQueries();
    setTicketFor(a.id);
  }

  const accounts = data?.accounts ?? [];

  return (
    <StaffShell title="Clientes de pie">
      {orderFor && barId && staff?.userId && (
        <StaffOrderDialog
          barId={barId}
          tableId={orderFor.tableId}
          tableNumber={orderFor.tableNumber}
          hasSession
          userId={staff.userId}
          onClose={() => setOrderFor(null)}
        />
      )}
      {detailFor && (
        <TableOrdersDialog
          sessionId={detailFor.id}
          tableNumber={detailFor.tables?.number ?? 0}
          nickname={detailFor.nickname}
          onClose={() => setDetailFor(null)}
        />
      )}
      {ticketFor && <InvoiceDialog sessionId={ticketFor} staff onClose={() => setTicketFor(null)} />}

      {canOrder && (
        <form
          className="mb-4 flex gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => { e.preventDefault(); void create(); }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (opcional): Paco, chico gorra…"
            maxLength={40}
          />
          <Button type="submit" disabled={busy} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Nueva cuenta
          </Button>
        </form>
      )}

      {accounts.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          No hay cuentas de barra abiertas. Pulsa «Nueva cuenta» para apuntar a alguien que pide de pie.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const lines = (data?.lines ?? []).filter((l) => l.orders?.session_id === a.id);
          const total = lines.reduce((s, l) => s + Number(l.price_snapshot) * l.qty, 0);
          const pending = lines.filter((l) => l.status !== "served");
          return (
            <div key={a.id} className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-xl font-extrabold">{a.nickname ?? "Barra"}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.opened_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mb-2 text-2xl font-bold">{formatEUR(total)}</p>
              {pending.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {pending.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => serve([l.id])}
                        className="flex w-full items-center justify-between rounded-md bg-secondary px-2 py-1 text-left text-sm"
                      >
                        <span>{l.qty}× {l.name_snapshot}</span>
                        <span className="text-xs text-muted-foreground">{l.status === "ready" ? "Listo" : "Servir"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {canOrder && (
                  <Button size="sm" variant="outline" onClick={() => setOrderFor({ tableId: a.table_id, tableNumber: a.tables?.number ?? 0 })}>
                    <Plus className="mr-1 h-4 w-4" /> Añadir
                  </Button>
                )}
                {pending.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => serve(pending.map((l) => l.id))}>
                    <Check className="mr-1 h-4 w-4" /> Servir todo ({pending.length})
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDetailFor(a)}>
                  <ListChecks className="mr-1 h-4 w-4" /> Ver comandas
                </Button>
                <Button size="sm" onClick={() => charge(a, pending.map((l) => l.id))}>
                  <Receipt className="mr-1 h-4 w-4" /> Cobrar {formatEUR(total)}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </StaffShell>
  );
}
