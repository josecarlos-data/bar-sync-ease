import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playAlert } from "@/lib/alertSound";

type PendingSession = {
  id: string;
  nickname: string | null;
  opened_at: string;
  tables: { number: number; name: string | null } | null;
  orders: {
    id: string;
    created_at: string;
    order_items: { id: string; name_snapshot: string; qty: number; note: string | null; deleted_at: string | null }[];
  }[];
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

export function SessionApprovalDialog({ barId }: { barId: string | null }) {
  const queryClient = useQueryClient();
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [confirmReject, setConfirmReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const alerted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: ["pending-sessions", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_sessions")
        .select(
          "id, nickname, opened_at, tables(number, name), orders(id, created_at, order_items(id, name_snapshot, qty, note, deleted_at))",
        )
        .eq("bar_id", barId!)
        .eq("status", "pending")
        .order("opened_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PendingSession[];
    },
  });

  const queue = sessions.filter((s) => (snoozed[s.id] ?? 0) <= now);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return;
    if (alerted.current.has(current.id)) return;
    alerted.current.add(current.id);
    playAlert();
  }, [current]);

  useEffect(() => {
    setConfirmReject(false);
  }, [current?.id]);

  if (!current) return null;

  async function decide(decision: "approved" | "rejected") {
    if (!current) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("decide_session", {
      _session_id: current.id,
      _decision: decision,
    });
    setBusy(false);
    setConfirmReject(false);
    const result = (data ?? null) as { ok?: boolean; reason?: string } | null;
    if (error) {
      toast.error("No se pudo aplicar la decisión");
      return;
    }
    if (result?.ok === false) {
      toast.info(
        result.reason === "already_decided"
          ? "Otro compañero ya ha decidido sobre esta mesa"
          : "Esta mesa ya no está pendiente",
      );
    } else {
      toast.success(decision === "approved" ? "Mesa aceptada" : "Mesa rechazada");
    }
    queryClient.invalidateQueries();
  }

  function snooze(seconds: number) {
    if (!current) return;
    const id = current.id;
    alerted.current.delete(id);
    setSnoozed((prev) => ({ ...prev, [id]: Date.now() + seconds * 1000 }));
  }

  const lines = current.orders
    .flatMap((o) => o.order_items.filter((l) => !l.deleted_at).map((l) => ({ ...l, order: o })))
    .sort((a, b) => a.order.created_at.localeCompare(b.order.created_at));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="bg-warning px-5 py-4 text-warning-foreground">
        <p className="text-xs font-bold tracking-wide uppercase">Mesa pendiente de aceptar</p>
        <h2 className="font-display text-3xl font-extrabold">Mesa {current.tables?.number ?? "?"}</h2>
        <p className="font-semibold">{current.nickname ?? "Sin apodo"}</p>
        <p className="text-sm opacity-90">Abierta a las {hhmm(current.opened_at)}</p>
        {queue.length > 1 && (
          <p className="mt-1 text-sm font-semibold">
            +{queue.length - 1} mesa{queue.length > 2 ? "s" : ""} más esperando
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no han enviado ninguna comanda.</p>
        )}
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-lg font-extrabold text-primary-foreground">
                {line.qty}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{line.name_snapshot}</p>
                {line.note && <p className="text-sm italic text-accent-foreground">“{line.note}”</p>}
              </div>
              <span className="tabular text-xs text-muted-foreground">{hhmm(line.order.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="space-y-2 border-t border-border p-4">
        {confirmReject ? (
          <>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
              Si rechazas esta mesa, sus comandas no llegarán a barra ni cocina. ¿Confirmar?
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => decide("rejected")}
                className="flex-1 rounded-lg bg-destructive py-3 font-semibold text-destructive-foreground disabled:opacity-50"
              >
                Sí, rechazar
              </button>
              <button
                onClick={() => setConfirmReject(false)}
                className="flex-1 rounded-lg border border-border py-3 font-semibold"
              >
                Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => decide("approved")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-success py-4 font-display text-lg font-extrabold text-success-foreground disabled:opacity-50"
            >
              <Check className="h-5 w-5" /> Aceptar mesa
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => snooze(30)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-3 text-sm font-semibold"
              >
                <Clock className="h-4 w-4" /> Posponer 30 s
              </button>
              <button
                onClick={() => snooze(60)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-3 text-sm font-semibold"
              >
                <Clock className="h-4 w-4" /> Posponer 60 s
              </button>
            </div>
            <button
              onClick={() => setConfirmReject(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive py-3 text-sm font-semibold text-destructive"
            >
              <X className="h-4 w-4" /> Rechazar mesa
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
