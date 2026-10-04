import { tableLabel, displayNickname } from "@/lib/tableLabel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineStatusBadge } from "@/components/LineStatusBadge";
import type { LineStatus } from "@/lib/types";

type Order = {
  id: string;
  created_at: string;
  created_by_role: string;
  order_items: {
    id: string;
    name_snapshot: string;
    qty: number;
    note: string | null;
    status: LineStatus;
    deleted_at: string | null;
    created_at: string;
  }[];
};

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  waiter: "Camarero",
  admin: "Administrador",
  bar: "Barra",
  kitchen: "Cocina",
};

export function TableOrdersDialog({
  sessionId,
  tableNumber,
  nickname,
  onClose,
}: {
  sessionId: string;
  tableNumber: number;
  nickname: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["table-orders", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, created_by_role, order_items(id, name_snapshot, qty, note, status, deleted_at, created_at)")
        .eq("session_id", sessionId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  async function serve(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("order_items")
      .update({ status: "served", served_at: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast.error("No se pudo marcar como servida"); return; }
    toast.success(ids.length > 1 ? "Comanda servida" : "Línea servida");
    queryClient.invalidateQueries();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-2xl font-extrabold">{tableLabel(tableNumber)}</p>
          <p className="text-sm text-muted-foreground">{displayNickname(nickname, tableNumber) ?? ""}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="rounded-lg border border-border p-2">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && orders.length === 0 && (
          <p className="text-sm text-muted-foreground">Esta mesa aún no tiene comandas.</p>
        )}
        {orders.map((order, idx) => {
          const lines = [...order.order_items].sort((a, b) => a.created_at.localeCompare(b.created_at));
          const live = lines.filter((l) => !l.deleted_at);
          const served = live.filter((l) => l.status === "served").length;
          const pct = live.length ? Math.round((served / live.length) * 100) : 0;
          const toServe = live.filter((l) => l.status !== "served").map((l) => l.id);
          return (
            <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between bg-secondary px-4 py-2 text-sm">
                <span className="font-bold">Comanda {idx + 1}</span>
                <span className="text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {ROLE_LABEL[order.created_by_role] ?? order.created_by_role}
                </span>
              </header>
              <div className="px-4 pt-3">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {served} de {live.length} servidas
                </p>
              </div>
              <ul className="divide-y divide-border">
                {lines.map((l) => (
                  <li key={l.id} className={`flex items-center gap-3 px-4 py-2 ${l.deleted_at ? "opacity-50 line-through" : ""}`}>
                    <span className="w-6 font-display text-lg font-extrabold">{l.qty}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{l.name_snapshot}</p>
                      {l.note && <p className="text-xs italic text-muted-foreground">“{l.note}”</p>}
                    </div>
                    {l.deleted_at ? (
                      <span className="text-[11px] font-bold text-muted-foreground">Eliminada</span>
                    ) : (
                      <>
                        <LineStatusBadge status={l.status} />
                        {l.status !== "served" && (
                          <button
                            onClick={() => serve([l.id])}
                            className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
                          >
                            Servir
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {toServe.length > 1 && (
                <button
                  onClick={() => serve(toServe)}
                  className="flex w-full items-center justify-center gap-1 bg-success py-2.5 text-sm font-semibold text-success-foreground"
                >
                  <CheckCheck className="h-4 w-4" /> Servir comanda completa
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
