import { supabase } from "@/integrations/supabase/client";
import { openSessionForTable } from "@/lib/bar.functions";

/**
 * Modo sin conexión para el personal: caché local de lo esencial
 * (mesas, colas, carta) y cola de operaciones que se reenvían
 * a la base de datos cuando vuelve la red.
 */

export type OfflineOp =
  | {
      id: string;
      at: string;
      kind: "line_status";
      barId: string;
      ids: string[];
      patch: Record<string, unknown>;
      matchStatus?: string;
      label: string;
    }
  | {
      id: string;
      at: string;
      kind: "part_paid";
      barId: string;
      partId: string;
      amount: number;
      method: string;
      label: string;
    }
  | {
      id: string;
      at: string;
      kind: "order";
      barId: string;
      tableId: string;
      nickname: string;
      userId: string;
      lines: Record<string, unknown>[];
      label: string;
    };

const CACHE_PREFIX = "offline-cache:";
const QUEUE_PREFIX = "offline-queue:";
const CHANGED_EVENT = "offline-queue-changed";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}
export function onQueueChanged(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

// ---------- Caché local ----------

export function cacheSet(barId: string, key: string, data: unknown) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${barId}:${key}`,
      JSON.stringify({ at: new Date().toISOString(), data }),
    );
  } catch {
    // almacenamiento lleno o no disponible: se sigue sin caché
  }
}

export function cacheGet<T>(barId: string, key: string): { at: string; data: T } | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${barId}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { at: string; data: T };
  } catch {
    return null;
  }
}

/** Ejecuta la consulta; si falla la red y hay copia guardada, la devuelve. */
export async function cachedFetch<T>(
  barId: string,
  key: string,
  offlineEnabled: boolean,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean; cachedAt: string | null }> {
  if (offlineEnabled && typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = cacheGet<T>(barId, key);
    if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.at };
  }
  try {
    const data = await fetcher();
    if (offlineEnabled) cacheSet(barId, key, data);
    return { data, fromCache: false, cachedAt: null };
  } catch (e) {
    if (offlineEnabled) {
      const cached = cacheGet<T>(barId, key);
      if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.at };
    }
    throw e;
  }
}

// ---------- Cola de operaciones ----------

export function listOps(barId: string): OfflineOp[] {
  try {
    const raw = localStorage.getItem(`${QUEUE_PREFIX}${barId}`);
    return raw ? (JSON.parse(raw) as OfflineOp[]) : [];
  } catch {
    return [];
  }
}

function saveOps(barId: string, ops: OfflineOp[]) {
  try {
    localStorage.setItem(`${QUEUE_PREFIX}${barId}`, JSON.stringify(ops));
  } catch {
    // sin espacio: no se puede encolar
  }
  notify();
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function enqueueOp(op: DistributiveOmit<OfflineOp, "id" | "at">) {
  const full = {
    ...op,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  } as OfflineOp;
  saveOps(op.barId, [...listOps(op.barId), full]);
  return full;
}

export function pendingCount(barId: string): number {
  return listOps(barId).length;
}

// ---------- Sincronización ----------

async function replayOp(op: OfflineOp): Promise<void> {
  if (op.kind === "line_status") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase.from("order_items").update(op.patch as any).in("id", op.ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (op.matchStatus) q = q.eq("status", op.matchStatus as any);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return;
  }
  if (op.kind === "part_paid") {
    const { error } = await supabase
      .from("bill_split_parts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        amount: op.amount,
        payment_method: op.method,
      })
      .eq("id", op.partId)
      .neq("status", "paid"); // nunca cobrar dos veces
    if (error) throw new Error(error.message);
    return;
  }
  // kind === "order": rehace la comanda completa contra la base de datos
  const res = await openSessionForTable({ data: { tableId: op.tableId, nickname: op.nickname } });
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      bar_id: res.barId,
      session_id: res.sessionId,
      created_by: op.userId,
      created_by_role: res.role ?? "waiter",
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(error?.message ?? "No se pudo crear la comanda");
  const lines = op.lines.map((l) => ({ ...l, bar_id: res.barId, order_id: order.id }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: le } = await supabase.from("order_items").insert(lines as any);
  if (le) throw new Error(le.message);
}

export type SyncResult = { synced: number; failed: { label: string; reason: string }[] };

/**
 * Reenvía las operaciones pendientes en su orden original.
 * Las que fallan (p. ej. la mesa se cerró mientras tanto) se descartan
 * y se devuelven en `failed` para avisar al camarero en vez de perderlas.
 */
export async function syncQueue(barId: string): Promise<SyncResult> {
  const ops = listOps(barId);
  const result: SyncResult = { synced: 0, failed: [] };
  if (!ops.length) return result;
  const remaining: OfflineOp[] = [];
  for (const op of ops) {
    try {
      await replayOp(op);
      result.synced += 1;
    } catch (e) {
      result.failed.push({
        label: op.label,
        reason: e instanceof Error ? e.message : "error desconocido",
      });
    }
  }
  saveOps(barId, remaining);
  return result;
}
