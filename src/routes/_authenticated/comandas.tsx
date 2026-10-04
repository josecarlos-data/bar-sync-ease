import { tableLabel } from "@/lib/tableLabel";
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaffShell } from "@/components/StaffShell";
import { SoundUnlockButton } from "@/components/SoundUnlockButton";
import { LineStatusBadge, ageClass, ageLabel } from "@/components/LineStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { playAlert } from "@/lib/alertSound";
import type { Destination, LineStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/comandas")({
  head: () => ({
    meta: [
      { title: "Comandas en vivo — Comandas de bar" },
      { name: "description", content: "Panel en tiempo real de comandas pendientes, en preparación y servidas." },
    ],
  }),
  component: LiveOrdersPage,
});

type Line = {
  id: string;
  name_snapshot: string;
  qty: number;
  note: string | null;
  status: LineStatus;
  destination: Destination;
  served_at: string | null;
};
type Order = {
  id: string;
  created_at: string;
  table_sessions: { nickname: string | null; status: string; tables: { number: number } | null } | null;
  order_items: (Line & { deleted_at: string | null })[];
};

type Col = "pending" | "progress" | "served";
const COLS: { key: Col; label: string }[] = [
  { key: "pending", label: "Pendientes" },
  { key: "progress", label: "En preparación / Preparadas" },
  { key: "served", label: "Servidas" },
];

function LiveOrdersPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const [filter, setFilter] = useState<"all" | Destination>("all");
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useRealtime("live-orders", ["orders", "order_items", "table_sessions"], !!barId);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["live-orders", barId],
    enabled: !!barId,
    queryFn: async () => {
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, table_sessions!inner(nickname, status, tables(number)), order_items(id, name_snapshot, qty, note, status, destination, served_at, deleted_at)")
        .eq("bar_id", barId!)
        .in("table_sessions.status", ["open", "closed"])
        .gte("created_at", since)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const ids = orders.filter((o) => o.table_sessions?.status === "open").map((o) => o.id);
    if (seen.current === null) { seen.current = new Set(ids); return; }
    const added = ids.filter((id) => !seen.current!.has(id));
    if (!added.length) return;
    added.forEach((id) => seen.current!.add(id));
    playAlert();
    setFresh((s) => new Set([...s, ...added]));
    setTimeout(() => setFresh((s) => { const n = new Set(s); added.forEach((i) => n.delete(i)); return n; }), 6000);
  }, [orders, isLoading]);

  const twoHoursAgo = now - 2 * 3600 * 1000;
  const cards: Record<Col, { order: Order; lines: Line[] }[]> = { pending: [], progress: [], served: [] };
  for (const order of orders) {
    const lines = order.order_items.filter(
      (l) => !l.deleted_at && (filter === "all" || l.destination === filter),
    );
    if (!lines.length) continue;
    const open = order.table_sessions?.status === "open";
    if (lines.every((l) => l.status === "served")) {
      const last = Math.max(...lines.map((l) => new Date(l.served_at ?? order.created_at).getTime()));
      if (last >= twoHoursAgo) cards.served.push({ order, lines });
    } else if (!open) {
      continue;
    } else if (lines.every((l) => l.status === "pending")) {
      cards.pending.push({ order, lines });
    } else {
      cards.progress.push({ order, lines });
    }
  }
  cards.served.reverse();

  return (
    <StaffShell title="Comandas en vivo">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["all", "Todo"], ["bar", "Barra"], ["kitchen", "Cocina"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === v ? "bg-foreground text-background" : "border border-border text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
        <div className="ml-auto"><SoundUnlockButton /></div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((col) => (
          <section key={col.key} className="space-y-2">
            <h2 className="flex items-center justify-between font-display text-lg font-extrabold">
              {col.label}
              <span className="rounded-full bg-secondary px-2 text-sm">{cards[col.key].length}</span>
            </h2>
            {cards[col.key].length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nada por aquí</p>
            )}
            {cards[col.key].map(({ order, lines }) => (
              <article
                key={order.id}
                className={`overflow-hidden rounded-xl border bg-card transition-all ${fresh.has(order.id) ? "border-primary ring-4 ring-primary/40" : "border-border"}`}
              >
                <header className="flex items-center justify-between bg-secondary px-3 py-2">
                  <span>
                    <span className="font-display text-xl font-extrabold">{tableLabel(order.table_sessions?.tables?.number)}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{order.table_sessions?.nickname ?? ""}</span>
                  </span>
                  <span className="text-right text-xs">
                    <span className="block text-muted-foreground">
                      {new Date(order.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {col.key !== "served" && (
                      <span className={ageClass(order.created_at, now)}>{ageLabel(order.created_at, now)}</span>
                    )}
                  </span>
                </header>
                <ul className="divide-y divide-border">
                  {lines.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <span className="w-5 font-bold">{l.qty}</span>
                      <span className="min-w-0 flex-1">
                        {l.name_snapshot}
                        {l.note && <span className="block text-xs italic text-muted-foreground">“{l.note}”</span>}
                      </span>
                      <LineStatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ))}
      </div>
    </StaffShell>
  );
}
