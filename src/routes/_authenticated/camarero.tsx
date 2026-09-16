import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, Receipt, X } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
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
  status: "pending" | "ready" | "served";
  orders: { session_id: string } | null;
};
type CallRow = { id: string; session_id: string; type: "waiter" | "bill" };

function WaiterPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const queryClient = useQueryClient();

  useRealtime("waiter", ["order_items", "orders", "table_sessions", "service_calls"], !!barId);

  const { data } = useQuery({
    queryKey: ["waiter-board", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [tables, sessions, calls] = await Promise.all([
        supabase
          .from("tables")
          .select("id, number, name, active")
          .eq("bar_id", barId!)
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
          .select("id, qty, price_snapshot, status, orders!inner(session_id)")
          .eq("bar_id", barId!)
          .is("deleted_at", null)
          .in("orders.session_id", sessionIds);
        lines = (lineData ?? []) as unknown as LineRow[];
      }

      return {
        tables: (tables.data ?? []) as TableRow[],
        sessions: (sessions.data ?? []) as SessionRow[],
        calls: (calls.data ?? []) as CallRow[],
        lines,
      };
    },
  });

  async function approve(sessionId: string) {
    const { error } = await supabase
      .from("table_sessions")
      .update({ status: "open", last_activity_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) { toast.error("No se pudo aceptar la mesa"); return; }
    toast.success("Mesa aceptada");
    queryClient.invalidateQueries();
  }

  async function closeSession(sessionId: string) {
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

  const tables = data?.tables ?? [];

  return (
    <StaffShell title="Mesas">
      <div className="grid gap-3 sm:grid-cols-2">
        {tables.map((table) => {
          const session = data?.sessions.find((s) => s.table_id === table.id);
          const lines = session
            ? (data?.lines ?? []).filter((l) => l.orders?.session_id === session.id)
            : [];
          const pending = lines.filter((l) => l.status === "pending").length;
          const ready = lines.filter((l) => l.status === "ready").length;
          const total = lines.reduce((sum, l) => sum + Number(l.price_snapshot) * l.qty, 0);
          const calls = session
            ? (data?.calls ?? []).filter((c) => c.session_id === session.id)
            : [];

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
                    {session?.nickname ?? table.name ?? "Sin ocupar"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}
                >
                  {state.label}
                </span>
              </div>

              {session && (
                <>
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <span>{pending} pendientes</span>
                    <span>{ready} listos</span>
                    <span className="tabular font-semibold text-foreground">
                      {formatEUR(total)}
                    </span>
                  </div>

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

                  <div className="mt-3 flex gap-2">
                    {session.status === "pending" && (
                      <button
                        onClick={() => approve(session.id)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground"
                      >
                        <Check className="h-4 w-4" /> Aceptar mesa
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
      {tables.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay mesas. Créalas en el apartado QR.
        </p>
      )}
    </StaffShell>
  );
}
