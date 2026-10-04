import { displayNickname } from "@/lib/tableLabel";
import { computeSplit } from "@/lib/split";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, FileText, ListChecks, Plus, Receipt, Sparkles, X } from "lucide-react";
import { StaffOrderDialog } from "@/components/StaffOrderDialog";
import { KitchenInstructionDialog } from "@/components/KitchenInstructionDialog";
import { StaffShell } from "@/components/StaffShell";
import { SessionApprovalDialog } from "@/components/SessionApprovalDialog";
import { SoundUnlockButton } from "@/components/SoundUnlockButton";
import { TableOrdersDialog } from "@/components/TableOrdersDialog";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { supabase } from "@/integrations/supabase/client";
import { useBarSettings, useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { formatEUR } from "@/lib/allergens";

export const Route = createFileRoute("/_authenticated/camarero")({
  head: () => ({
    meta: [
      { title: "Mesas — Comandas de bar" },
      { name: "description", content: "Estado de las mesas, llamadas y cierre de sesiones." },
    ],
  }),
  component: WaiterPage,
});

type TableRow = { id: string; number: number; name: string | null; active: boolean };
type SessionRow = {
  id: string;
  table_id: string;
  nickname: string | null;
  status: "pending" | "open";
};
type LineRow = {
  id: string;
  qty: number;
  price_snapshot: number;
  name_snapshot: string;
  status: "pending" | "preparing" | "ready" | "served";
  note: string | null;
  destination: "bar" | "kitchen";
  created_at: string;
  orders: { session_id: string } | null;
};
type CallRow = { id: string; session_id: string; type: "waiter" | "bill" };
type SplitRow = {
  id: string;
  session_id: string;
  mode: "equal" | "groups";
  people: number;
  status: "open" | "requested" | "settled";
  bill_split_parts: {
    id: string;
    label: string;
    position: number;
    amount: number;
    status: "pending" | "paid" | "with_waiter";
    bill_split_assignments: { id: string; order_item_id: string; qty: number }[];
  }[];
};

function WaiterPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const queryClient = useQueryClient();
  const { data: settings } = useBarSettings(barId);
  const isAdmin = staff?.roles.includes("admin") ?? false;
  const isWaiterish = staff?.roles.some((r) => r === "admin" || r === "waiter") ?? false;
  const canOrder = isAdmin || settings?.waiter_can_order !== false;
  const [orderFor, setOrderFor] = useState<{ tableId: string; tableNumber: number; hasSession: boolean } | null>(null);
  const [detailFor, setDetailFor] = useState<{ sessionId: string; tableNumber: number; nickname: string | null } | null>(null);
  const [instructionFor, setInstructionFor] = useState<{ sessionId: string; tableNumber: number } | null>(null);
  const [ticketFor, setTicketFor] = useState<string | null>(null);

  useRealtime("waiter", ["order_items", "orders", "table_sessions", "service_calls", "bill_splits", "bill_split_parts", "bill_split_assignments"], !!barId);

  const { data } = useQuery({
    queryKey: ["waiter-board", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [tables, sessions, calls] = await Promise.all([
        supabase
          .from("tables")
          .select("id, number, name, active")
          .eq("bar_id", barId!)
          .eq("kind", "table")
          .order("number"),
        supabase
          .from("table_sessions")
          .select("id, table_id, nickname, status")
          .eq("bar_id", barId!)
          .neq("status", "closed"),
        supabase
          .from("service_calls")
          .select("id, session_id, type")
          .eq("bar_id", barId!)
          .eq("status", "open"),
      ]);

      const sessionIds = (sessions.data ?? []).map((s) => s.id);
      let lines: LineRow[] = [];
      if (sessionIds.length) {
        const { data: lineData } = await supabase
          .from("order_items")
          .select("id, qty, price_snapshot, name_snapshot, status, note, destination, created_at, orders!inner(session_id)")
          .eq("bar_id", barId!)
          .is("deleted_at", null)
          .in("orders.session_id", sessionIds);
        lines = (lineData ?? []) as unknown as LineRow[];
      }

      let splits: SplitRow[] = [];
      if (sessionIds.length) {
        const { data: splitData } = await supabase
          .from("bill_splits")
          .select("id, session_id, mode, people, status, bill_split_parts(id, label, position, amount, status, bill_split_assignments(id, order_item_id, qty))")
          .in("session_id", sessionIds);
        splits = (splitData ?? []) as unknown as SplitRow[];
      }

      return {
        tables: (tables.data ?? []) as TableRow[],
        sessions: (sessions.data ?? []) as SessionRow[],
        calls: (calls.data ?? []) as CallRow[],
        lines,
        splits,
      };
    },
  });

  async function approve(sessionId: string) {
    const { data: result, error } = await supabase.rpc("decide_session", {
      _session_id: sessionId,
      _decision: "approved",
    });
    if (error) { toast.error("No se pudo aceptar la mesa"); return; }
    const res = (result ?? null) as { ok?: boolean } | null;
    toast[res?.ok === false ? "info" : "success"](
      res?.ok === false ? "Otro compañero ya ha decidido" : "Mesa aceptada",
    );
    queryClient.invalidateQueries();
  }

  async function closeSession(sessionId: string) {
    const split = (data?.splits ?? []).find((s) => s.session_id === sessionId);
    if (split) {
      const c = splitCalc(split, sessionId);
      const unpaid = split.bill_split_parts.filter((p) => p.status !== "paid" && (c.amounts.get(p.id) ?? 0) > 0.009);
      if (c.unassigned > 0.009 || unpaid.length) {
        toast.error(
          [c.unassigned > 0.009 ? `Sin asignar: ${formatEUR(c.unassigned)}` : null,
           unpaid.length ? `Sin cobrar: ${unpaid.map((p) => p.label).join(", ")}` : null].filter(Boolean).join(" · "),
        );
        return;
      }
    }
    const { error } = await supabase
      .from("table_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: staff?.userId ?? null,
      })
      .eq("id", sessionId);
    if (error) { toast.error("No se pudo cerrar la mesa"); return; }
    toast.success("Mesa cerrada");
    queryClient.invalidateQueries();
    setTicketFor(sessionId);
  }

  async function handleCall(callId: string) {
    const { error } = await supabase
      .from("service_calls")
      .update({
        status: "done",
        handled_at: new Date().toISOString(),
        handled_by: staff?.userId ?? null,
      })
      .eq("id", callId);
    if (error) { toast.error("No se pudo marcar la llamada"); return; }
    queryClient.invalidateQueries();
  }

  function splitCalc(split: SplitRow, sessionId: string) {
    const lines = (data?.lines ?? [])
      .filter((l) => l.orders?.session_id === sessionId)
      .map((l) => ({ id: l.id, name: l.name_snapshot, price: Number(l.price_snapshot), qty: l.qty }));
    return { lines, ...computeSplit(split.mode, split.bill_split_parts, lines) };
  }

  async function assignToWaiter(split: SplitRow, sessionId: string) {
    const c = splitCalc(split, sessionId);
    if (c.unassigned <= 0.009) return;
    if (split.mode === "equal") {
      await supabase.from("bill_split_parts").insert({
        bar_id: barId!, split_id: split.id, label: "Consumo posterior",
        position: split.bill_split_parts.length, amount: c.unassigned,
      });
    } else {
      let part = split.bill_split_parts.find((p) => p.status === "with_waiter");
      if (!part) {
        const { data: created } = await supabase
          .from("bill_split_parts")
          .insert({ bar_id: barId!, split_id: split.id, label: "Pendiente con camarero", position: 99, status: "with_waiter" })
          .select("id, label, position, amount, status")
          .single();
        if (!created) { toast.error("No se pudo asignar"); return; }
        part = { ...(created as never as SplitRow["bill_split_parts"][number]), bill_split_assignments: [] };
      }
      for (const line of c.unassignedLines) {
        const ex = part.bill_split_assignments.find((a) => a.order_item_id === line.id);
        if (ex) await supabase.from("bill_split_assignments").update({ qty: Number(ex.qty) + line.left }).eq("id", ex.id);
        else await supabase.from("bill_split_assignments").insert({ bar_id: barId!, part_id: part.id, order_item_id: line.id, qty: line.left });
      }
    }
    queryClient.invalidateQueries();
  }

  async function markPartPaid(partId: string, amount: number) {
    const { data: part, error } = await supabase
      .from("bill_split_parts")
      .update({ status: "paid", paid_at: new Date().toISOString(), amount })
      .eq("id", partId)
      .select("split_id")
      .single();
    if (error) {
      toast.error(error.message.includes("unassigned") ? "Queda consumo sin asignar: repartidlo antes de cobrar" : "No se pudo marcar como cobrada");
      return;
    }
    queryClient.invalidateQueries();
    const { data: split } = await supabase.from("bill_splits").select("session_id").eq("id", part.split_id).single();
    if (split) setTicketFor(split.session_id);
  }

  async function setLines(ids: string[], status: "ready" | "served") {
    if (!ids.length) return;
    const now = new Date().toISOString();
    const patch = status === "served" ? { status, served_at: now } : { status, ready_at: now };
    const { error } = await supabase.from("order_items").update(patch).in("id", ids);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success(status === "served" ? (ids.length > 1 ? `${ids.length} servidos` : "Servido") : "Listo");
    queryClient.invalidateQueries();
  }

  const tables = data?.tables ?? [];
  const solo = settings?.service_mode === "solo";
  const tableBySession = new Map(
    (data?.sessions ?? []).map((s) => [s.id, tables.find((t) => t.id === s.table_id)?.number ?? 0]),
  );
  const kitchenQueue = solo
    ? (data?.lines ?? [])
        .filter((l) => l.destination === "kitchen" && (l.status === "pending" || l.status === "preparing"))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];

  return (
    <StaffShell title="Mesas">
      {isWaiterish && (
        <div className="mb-3">
          <SoundUnlockButton />
        </div>
      )}
      {isWaiterish && <SessionApprovalDialog barId={barId} />}
      {orderFor && barId && staff?.userId && (
        <StaffOrderDialog
          barId={barId}
          tableId={orderFor.tableId}
          tableNumber={orderFor.tableNumber}
          hasSession={orderFor.hasSession}
          userId={staff.userId}
          onClose={() => setOrderFor(null)}
        />
      )}
      {detailFor && (
        <TableOrdersDialog
          sessionId={detailFor.sessionId}
          tableNumber={detailFor.tableNumber}
          nickname={detailFor.nickname}
          onClose={() => setDetailFor(null)}
        />
      )}
      {instructionFor && barId && staff?.userId && (
        <KitchenInstructionDialog
          barId={barId}
          sessionId={instructionFor.sessionId}
          tableNumber={instructionFor.tableNumber}
          userId={staff.userId}
          onClose={() => setInstructionFor(null)}
        />
      )}
      {solo && kitchenQueue.length > 0 && (
        <section className="mb-4 rounded-xl border-2 border-warning bg-card p-3">
          <p className="mb-2 font-display text-lg font-bold">Por preparar en cocina ({kitchenQueue.length})</p>
          <ul className="space-y-2">
            {kitchenQueue.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2">
                <span className="min-w-0">
                  <span className="mr-2 rounded bg-foreground px-1.5 py-0.5 text-xs font-bold text-background">
                    Mesa {tableBySession.get(l.orders?.session_id ?? "") ?? "?"}
                  </span>
                  <b className="tabular">{l.qty}×</b> {l.name_snapshot}
                  {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => setLines([l.id], "ready")} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold">Listo</button>
                  <button onClick={() => setLines([l.id], "served")} className="rounded-md bg-success px-2 py-1.5 text-xs font-semibold text-success-foreground">Servido</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {tables.map((table) => {
          const session = data?.sessions.find((s) => s.table_id === table.id);
          const lines = session
            ? (data?.lines ?? []).filter((l) => l.orders?.session_id === session.id)
            : [];
          const pending = lines.filter((l) => l.status === "pending" || l.status === "preparing").length;
          const ready = lines.filter((l) => l.status === "ready").length;
          const total = lines.reduce((sum, l) => sum + Number(l.price_snapshot) * l.qty, 0);
          const calls = session
            ? (data?.calls ?? []).filter((c) => c.session_id === session.id)
            : [];
          const split = session
            ? (data?.splits ?? []).find((s) => s.session_id === session.id)
            : undefined;

          const state = !session
            ? { label: "Libre", className: "bg-muted text-muted-foreground" }
            : session.status === "pending"
              ? { label: "Pendiente de aceptar", className: "bg-warning text-warning-foreground" }
              : calls.some((c) => c.type === "bill")
                ? { label: "Pide la cuenta", className: "bg-foreground text-background" }
                : calls.length > 0
                  ? { label: "Llamada", className: "bg-primary text-primary-foreground" }
                  : ready > 0
                    ? { label: "Listo para servir", className: "bg-success text-success-foreground" }
                    : pending > 0
                      ? { label: "Con pedido", className: "bg-accent text-accent-foreground" }
                      : { label: "Abierta", className: "bg-secondary text-secondary-foreground" };

          return (
            <article key={table.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl font-extrabold">Mesa {table.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {session ? (displayNickname(session.nickname, table.number) ?? table.name ?? "Ocupada") : (table.name ?? "Sin ocupar")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}
                >
                  {state.label}
                </span>
              </div>

              {canOrder && (
                <button
                  onClick={() => setOrderFor({ tableId: table.id, tableNumber: table.number, hasSession: !!session })}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Añadir comanda
                </button>
              )}

              {session && isWaiterish && (
                <>
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <span>{pending} pendientes</span>
                    <span>{ready} listos</span>
                    <span className="tabular font-semibold text-foreground">
                      {formatEUR(total)}
                    </span>
                  </div>

                  {(() => {
                    const unserved = lines.filter((l) => l.status !== "served");
                    if (!unserved.length) return null;
                    const readyFirst = [...unserved].sort(
                      (a, b) => Number(b.status === "ready") - Number(a.status === "ready"),
                    );
                    return (
                      <div className="mt-3 rounded-lg border border-border p-2">
                        <button
                          onClick={() => setLines(unserved.map((l) => l.id), "served")}
                          className="flex w-full items-center justify-center gap-1 rounded-lg bg-success py-2.5 text-sm font-bold text-success-foreground"
                        >
                          <Check className="h-4 w-4" /> Servir todo ({unserved.reduce((s, l) => s + l.qty, 0)})
                        </button>
                        <p className="mt-2 text-xs text-muted-foreground">Toca una línea para servirla sola:</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {readyFirst.map((l) => (
                            <li key={l.id}>
                              <button
                                onClick={() => setLines([l.id], "served")}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  l.status === "ready"
                                    ? "bg-success/20 text-foreground ring-1 ring-success"
                                    : "bg-secondary text-secondary-foreground"
                                }`}
                              >
                                {l.qty}× {l.name_snapshot}
                                {l.status === "ready" ? " · listo" : ""}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {calls.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {calls.map((call) => (
                        <li
                          key={call.id}
                          className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 font-semibold">
                            {call.type === "bill" ? (
                              <Receipt className="h-4 w-4" />
                            ) : (
                              <BellRing className="h-4 w-4" />
                            )}
                            {call.type === "bill" ? "Pide la cuenta" : "Llama al camarero"}
                          </span>
                          <button
                            onClick={() => handleCall(call.id)}
                            className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                          >
                            Atendida
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {split && (() => {
                    const c = splitCalc(split, session!.id);
                    const blocked = c.unassigned > 0.009;
                    const anyPaid = split.bill_split_parts.some((p) => p.status === "paid");
                    return (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      {anyPaid && blocked && (
                        <span className="mb-2 inline-block rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
                          Consumo nuevo tras pagar
                        </span>
                      )}
                      <p className="text-sm font-bold">
                        {split.mode === "equal"
                          ? `Cuenta dividida entre ${split.people}`
                          : "Cuenta dividida por consumo"}
                        {split.status === "requested" && " · solicitada"}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {[...split.bill_split_parts]
                          .sort((a, b) => a.position - b.position)
                          .map((part) => (
                            <li
                              key={part.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {part.label}
                                {part.status === "with_waiter" && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    pendiente contigo
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="tabular font-semibold">
                                  {formatEUR(c.amounts.get(part.id) ?? 0)}
                                </span>
                                {part.status === "paid" ? (
                                  <span className="text-xs font-bold text-success">Pagada</span>
                                ) : (
                                  <button
                                    onClick={() => markPartPaid(part.id, c.amounts.get(part.id) ?? 0)}
                                    disabled={blocked}
                                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40"
                                  >
                                    Cobrada
                                  </button>
                                )}
                              </span>
                            </li>
                          ))}
                      </ul>
                      {blocked && (
                        <div className="mt-2 rounded-md bg-warning/15 p-2 text-xs">
                          <p className="font-semibold">Sin asignar: {formatEUR(c.unassigned)} — pídeles que lo repartan</p>
                          <button
                            onClick={() => assignToWaiter(split, session!.id)}
                            className="mt-1 rounded-md border border-border bg-card px-2 py-1 font-semibold"
                          >
                            Asignarlo yo
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {lines.length > 0 && (
                    <button
                      onClick={() => setDetailFor({ sessionId: session.id, tableNumber: table.number, nickname: session.nickname })}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm font-semibold"
                    >
                      <ListChecks className="h-4 w-4" /> Ver comandas
                    </button>
                  )}

                  {lines.length > 0 && (
                    <button
                      onClick={() => setInstructionFor({ sessionId: session.id, tableNumber: table.number })}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-primary py-2 text-sm font-semibold text-primary"
                    >
                      <Sparkles className="h-4 w-4" /> Indicación a cocina
                    </button>
                  )}

                  <div className="mt-3 flex gap-2">
                    {session.status === "pending" && (
                      <button
                        onClick={() => approve(session.id)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground"
                      >
                        <Check className="h-4 w-4" /> Aceptar mesa
                      </button>
                    )}
                    {lines.length > 0 && (
                      <button
                        onClick={() => setTicketFor(session.id)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-sm font-semibold"
                      >
                        <FileText className="h-4 w-4" /> Ticket
                      </button>
                    )}
                    <button
                      onClick={() => closeSession(session.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-sm font-semibold"
                    >
                      <X className="h-4 w-4" /> Cerrar mesa
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {ticketFor && <InvoiceDialog sessionId={ticketFor} staff onClose={() => setTicketFor(null)} />}
      {tables.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay mesas. Créalas en el apartado QR.
        </p>
      )}
    </StaffShell>
  );
}
