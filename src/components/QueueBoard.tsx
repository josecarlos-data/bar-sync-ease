import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import type { Destination } from "@/lib/types";

type QueueLine = {
  id: string;
  name_snapshot: string;
  qty: number;
  note: string | null;
  destination: Destination;
  created_at: string;
  order_id: string;
  orders: {
    created_at: string;
    table_sessions: {
      nickname: string | null;
      tables: { number: number; name: string | null } | null;
    } | null;
  } | null;
};

type SortMode = "arrival" | "table" | "product";

export function QueueBoard({ destination }: { destination: Destination }) {
  const { data: staff } = useStaff();
  const { data: settings } = useBarSettings(staff?.barId);
  const barId = staff?.barId ?? null;
  const [sortOverride, setSortOverride] = useState<SortMode | null>(null);
  const queryClient = useQueryClient();

  useRealtime("queue", ["order_items", "orders", "table_sessions", "order_instructions"], !!barId);

  const singleQueue = settings ? !settings.split_bar_kitchen : false;
  const sort: SortMode = sortOverride ?? settings?.queue_sort ?? "arrival";

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["queue", barId, destination, singleQueue],
    enabled: !!barId && !!settings,
    queryFn: async () => {
      let query = supabase
        .from("order_items")
        .select(
          "id, name_snapshot, qty, note, destination, created_at, order_id, orders!inner(created_at, session_id, table_sessions!inner(status, nickname, tables!inner(number, name)))",
        )
        .eq("bar_id", barId!)
        .eq("orders.table_sessions.status", "open")
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!singleQueue) query = query.eq("destination", destination);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as QueueLine[];
    },
  });

  const orderIds = [...new Set(lines.map((l) => l.order_id))].sort();
  const { data: instructions = [] } = useQuery({
    queryKey: ["queue-instructions", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_instructions")
        .select("id, order_id, instruction_text, created_at")
        .in("order_id", orderIds)
        .order("created_at");
      return data ?? [];
    },
  });
  const instructionsFor = (orderId: string) =>
    instructions.filter((i) => i.order_id === orderId).map((i) => i.instruction_text);

  async function markReady(ids: string[]) {
    const { error } = await supabase
      .from("order_items")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast.error("No se pudo marcar como listo");
      return;
    }
    toast.success(ids.length > 1 ? "Comanda lista" : "Línea lista");
    queryClient.invalidateQueries();
  }

  const sorted = [...lines].sort((a, b) => {
    if (sort === "table") {
      const ta = a.orders?.table_sessions?.tables?.number ?? 0;
      const tb = b.orders?.table_sessions?.tables?.number ?? 0;
      if (ta !== tb) return ta - tb;
    }
    if (sort === "product") {
      const cmp = a.name_snapshot.localeCompare(b.name_snapshot, "es");
      if (cmp !== 0) return cmp;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const groups = new Map<string, QueueLine[]>();
  for (const line of sorted) {
    const list = groups.get(line.order_id) ?? [];
    list.push(line);
    groups.set(line.order_id, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Orden</span>
        {(
          [
            ["arrival", "Llegada"],
            ["table", "Mesa"],
            ["product", "Producto"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSortOverride(value)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              sort === value
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando cola…</p>}
      {!isLoading && sorted.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No hay nada pendiente.
        </div>
      )}

      {sort === "arrival"
        ? [...groups.entries()].map(([orderId, orderLines]) => (
            <OrderCard
              key={orderId}
              lines={orderLines}
              instructions={instructionsFor(orderId)}
              onReadyAll={() => markReady(orderLines.map((l) => l.id))}
              onReadyLine={(id) => markReady([id])}
            />
          ))
        : sorted.map((line) => (
            <OrderCard
              key={line.id}
              lines={[line]}
              instructions={instructionsFor(line.order_id)}
              onReadyAll={() => markReady([line.id])}
              onReadyLine={(id) => markReady([id])}
            />
          ))}
    </div>
  );
}

function OrderCard({
  lines,
  instructions,
  onReadyAll,
  onReadyLine,
}: {
  lines: QueueLine[];
  instructions: string[];
  onReadyAll: () => void;
  onReadyLine: (id: string) => void;
}) {
  const session = lines[0]?.orders?.table_sessions;
  const table = session?.tables;
  const time = new Date(lines[0]?.created_at ?? Date.now()).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 bg-secondary px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold">Mesa {table?.number ?? "?"}</span>
          <span className="truncate text-sm font-semibold text-muted-foreground">
            {session?.nickname ?? ""}
          </span>
        </div>
        <span className="tabular text-xs text-muted-foreground">{time}</span>
      </header>
      {instructions.length > 0 && (
        <div className="space-y-1 border-b border-warning bg-warning/15 px-4 py-2">
          {instructions.map((t, i) => (
            <p key={i} className="whitespace-pre-line text-sm font-bold">{t}</p>
          ))}
        </div>
      )}
      <ul className="divide-y divide-border">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-xl font-extrabold text-primary-foreground">
              {line.qty}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-tight font-semibold">{line.name_snapshot}</p>
              {line.note && <p className="text-sm text-accent-foreground italic">“{line.note}”</p>}
            </div>
            <button
              onClick={() => onReadyLine(line.id)}
              className="rounded-lg border border-success p-2 text-success"
              aria-label="Marcar línea como lista"
            >
              <Check className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      {lines.length > 1 && (
        <button
          onClick={onReadyAll}
          className="w-full bg-success py-3 font-semibold text-success-foreground"
        >
          Comanda completa lista
        </button>
      )}
    </article>
  );
}
