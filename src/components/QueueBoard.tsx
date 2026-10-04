import { tableLabel } from "@/lib/tableLabel";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Flame, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { useSpeech, useAutoSpeak, isAudioUnlocked, unlockAudio } from "@/hooks/useSpeech";
import type { Destination, LineStatus } from "@/lib/types";
import { PrintAgent } from "@/components/PrintAgent";

type QueueLine = {
  id: string;
  name_snapshot: string;
  qty: number;
  note: string | null;
  status: LineStatus;
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
          "id, name_snapshot, qty, note, status, destination, created_at, order_id, orders!inner(created_at, session_id, table_sessions!inner(status, nickname, tables!inner(number, name)))",
        )
        .eq("bar_id", barId!)
        .eq("orders.table_sessions.status", "open")
        .in("status", ["pending", "preparing"])
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

  const voice = settings?.kitchen_voice ?? "device";
  const autoSpeak = useAutoSpeak(voice, settings?.kitchen_voice_auto ?? false);
  const seenInstructions = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!instructions.length) return;
    if (seenInstructions.current === null) {
      // First load: don't read out the whole backlog
      seenInstructions.current = new Set(instructions.map((i) => i.id));
      return;
    }
    for (const ins of instructions) {
      if (!seenInstructions.current.has(ins.id)) {
        seenInstructions.current.add(ins.id);
        autoSpeak(ins.id, ins.instruction_text);
      }
    }
  }, [instructions, autoSpeak]);

  const orderMode = settings?.order_voice_auto ?? "off";
  const autoSpeakOrder = useAutoSpeak(voice, orderMode !== "off");
  const seenOrders = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (isLoading || !settings) return;
    const byOrder = new Map<string, QueueLine[]>();
    for (const l of lines) byOrder.set(l.order_id, [...(byOrder.get(l.order_id) ?? []), l]);
    if (seenOrders.current === null) {
      seenOrders.current = new Set(byOrder.keys());
      return;
    }
    for (const [orderId, orderLines] of byOrder) {
      if (seenOrders.current.has(orderId)) continue;
      seenOrders.current.add(orderId);
      autoSpeakOrder(`order-${orderId}`, orderSpeech(orderLines, [], orderMode === "full"));
    }
  }, [lines, isLoading, settings, orderMode, autoSpeakOrder]);

  async function markPreparing(ids: string[]) {
    const { error } = await supabase
      .from("order_items")
      .update({ status: "preparing", started_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "pending");
    if (error) { toast.error("No se pudo empezar"); return; }
    queryClient.invalidateQueries();
  }

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
      <div className="flex flex-wrap items-center gap-2">
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
        {!isAudioUnlocked() &&
          ((settings?.kitchen_voice_auto ?? false) || orderMode !== "off") && (
          <button
            onClick={() => {
              unlockAudio();
              toast.success("Avisos de voz activados");
              queryClient.invalidateQueries();
            }}
            className="ml-auto flex items-center gap-1 rounded-full border border-warning bg-warning/15 px-3 py-1 text-sm font-semibold"
          >
            <Volume2 className="h-4 w-4" /> Activar voz
          </button>
        )}
      </div>
      {barId && settings && <PrintAgent barId={barId} settings={settings} destination={destination} />}

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
              voice={voice}
              onStartAll={() => markPreparing(orderLines.map((l) => l.id))}
              onStartLine={(id) => markPreparing([id])}
              onReadyAll={() => markReady(orderLines.map((l) => l.id))}
              onReadyLine={(id) => markReady([id])}
            />
          ))
        : sorted.map((line) => (
            <OrderCard
              key={line.id}
              lines={[line]}
              instructions={instructionsFor(line.order_id)}
              voice={voice}
              onStartAll={() => markPreparing([line.id])}
              onStartLine={(id) => markPreparing([id])}
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
  voice,
  onReadyAll,
  onReadyLine,
  onStartAll,
  onStartLine,
}: {
  onStartAll: () => void;
  onStartLine: (id: string) => void;
  lines: QueueLine[];
  instructions: string[];
  voice: "device" | "ai";
  onReadyAll: () => void;
  onReadyLine: (id: string) => void;
}) {
  const session = lines[0]?.orders?.table_sessions;
  const table = session?.tables;
  const time = new Date(lines[0]?.created_at ?? Date.now()).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const { speak, speaking } = useSpeech(voice);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 bg-secondary px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold">{tableLabel(table?.number)}</span>
          <span className="truncate text-sm font-semibold text-muted-foreground">
            {session?.nickname ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular text-xs text-muted-foreground">{time}</span>
          <button
            onClick={() => speak(orderSpeech(lines, instructions, true))}
            aria-label={speaking ? "Detener lectura" : "Leer comanda en voz alta"}
            className="rounded-lg border border-border bg-card p-1.5 text-foreground"
          >
            {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </header>
      {instructions.length > 0 && (
        <div className="space-y-1 border-b border-warning bg-warning/15 px-4 py-2">
          {instructions.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <p className="flex-1 whitespace-pre-line text-sm font-bold">{t}</p>
              <button
                onClick={() => speak(t)}
                aria-label={speaking ? "Detener lectura" : "Leer indicación en voz alta"}
                className="shrink-0 rounded-lg border border-warning bg-card p-1.5 text-foreground"
              >
                {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
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
            {line.status === "pending" ? (
              <button
                onClick={() => onStartLine(line.id)}
                className="rounded-lg border border-warning p-2 text-warning-foreground"
                aria-label="Empezar a preparar"
              >
                <Flame className="h-5 w-5" />
              </button>
            ) : (
              <span className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">Preparando</span>
            )}
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
      {lines.some((l) => l.status === "pending") && lines.length > 1 && (
        <button
          onClick={onStartAll}
          className="w-full border-t border-border bg-warning/20 py-2.5 font-semibold"
        >
          Empezar comanda
        </button>
      )}
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

const NUMS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

function orderSpeech(lines: QueueLine[], instructions: string[], full: boolean): string {
  const session = lines[0]?.orders?.table_sessions;
  const mesa = tableLabel(session?.tables?.number);
  if (!full) return `Nueva comanda, ${mesa}.`;
  const items = lines
    .map((l) => `${NUMS[l.qty] ?? l.qty} ${l.name_snapshot}${l.note ? `, ${l.note}` : ""}`)
    .join(". ");
  const extra = instructions.length ? `. Indicaciones: ${instructions.join(". ")}` : "";
  return `${mesa}${session?.nickname ? `, ${session.nickname}` : ""}. ${items}${extra}.`;
}
