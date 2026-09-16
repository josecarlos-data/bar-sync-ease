import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Histórico de mesas — Comandas de bar" },
      {
        name: "description",
        content: "Mesas rechazadas y cerradas con su detalle y quién decidió.",
      },
    ],
  }),
  component: HistoryPage,
});

type HistSession = {
  id: string;
  nickname: string | null;
  status: "rejected" | "closed";
  opened_at: string;
  decided_at: string | null;
  decision: string | null;
  decided_by: string | null;
  tables: { number: number; name: string | null } | null;
  orders: {
    id: string;
    created_at: string;
    order_items: { id: string; name_snapshot: string; qty: number; note: string | null; deleted_at: string | null }[];
  }[];
};

function HistoryPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<{ sessionId: string; nickname: string | null } | null>(null);

  useRealtime("history", ["table_sessions", "orders", "order_items"], !!barId);

  const { data } = useQuery({
    queryKey: ["session-history", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from("table_sessions")
        .select(
          "id, nickname, status, opened_at, decided_at, decision, decided_by, tables(number, name), orders(id, created_at, order_items(id, name_snapshot, qty, note, deleted_at))",
        )
        .eq("bar_id", barId!)
        .in("status", ["rejected", "closed"])
        .order("opened_at", { ascending: false })
        .limit(100);

      const list = (sessions ?? []) as unknown as HistSession[];
      const ids = [...new Set(list.map((s) => s.decided_by).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Personal"]));
      }
      return { list, names };
    },
  });

  async function restore(sessionId: string, merge: boolean) {
    const { data: result, error } = await supabase.rpc("decide_session", {
      _session_id: sessionId,
      _decision: "restored",
      _merge: merge,
    });
    if (error) {
      toast.error("No se pudo restablecer la mesa");
      return;
    }
    const res = (result ?? null) as
      | { ok?: boolean; reason?: string; active_nickname?: string | null }
      | null;
    if (res?.ok === false && res.reason === "active_session") {
      setConflict({ sessionId, nickname: res.active_nickname ?? null });
      return;
    }
    setConflict(null);
    if (res?.ok === false) {
      toast.info("Esta mesa ya no está rechazada");
    } else {
      toast.success(merge ? "Comandas fusionadas en la mesa activa" : "Mesa restablecida y aceptada");
    }
    queryClient.invalidateQueries();
  }

  const list = data?.list ?? [];

  return (
    <StaffShell title="Histórico de mesas">
      <div className="space-y-3">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay mesas cerradas ni rechazadas.</p>
        )}
        {list.map((s) => {
          const lines = s.orders.flatMap((o) => o.order_items.filter((l) => !l.deleted_at));
          const who = s.decided_by ? (data?.names[s.decided_by] ?? "Personal") : null;
          return (
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-extrabold">Mesa {s.tables?.number ?? "?"}</p>
                  <p className="text-sm text-muted-foreground">{s.nickname ?? "Sin apodo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.opened_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {who && ` · decidió ${who}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    s.status === "rejected"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.status === "rejected" ? "Rechazada" : "Cerrada"}
                </span>
              </div>

              {lines.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {lines.map((l) => (
                    <li key={l.id}>
                      {l.qty} × {l.name_snapshot}
                      {l.note && <span className="text-muted-foreground italic"> · {l.note}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {s.status === "rejected" && (
                <button
                  onClick={() => restore(s.id, false)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground"
                >
                  <RotateCcw className="h-4 w-4" /> Restablecer y aprobar
                </button>
              )}
            </article>
          );
        })}
      </div>

      <Dialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esta mesa ya tiene otra sesión activa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            En esa mesa hay una sesión activa{conflict?.nickname ? ` (${conflict.nickname})` : ""}. Puedes
            fusionar las comandas restablecidas en ella o cancelar el restablecimiento.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setConflict(null)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={() => conflict && restore(conflict.sessionId, true)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Fusionar comandas
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffShell>
  );
}
