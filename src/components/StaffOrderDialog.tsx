import { tableLabel } from "@/lib/tableLabel";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openSessionForTable } from "@/lib/bar.functions";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { MenuBrowser } from "@/components/MenuBrowser";
import { useBarSettings } from "@/hooks/useStaff";
import { useMenuPopularity } from "@/hooks/useMenuPopularity";
import { cachedFetch, enqueueOp } from "@/lib/offline";
import { Input } from "@/components/ui/input";
import type { Category, Item } from "@/lib/types";
import { cartDrinks, choiceAllowance, houseTapaLines, priceCart, pricedTotal, proposeRounds, roundLabel, tapaMode, type SessionTapaLine } from "@/lib/tapas";

type CartLine = { itemId: string; qty: number; note: string };

/** Carta del personal; con el modo sin conexión se guarda para poder pedir sin red. */
export async function loadStaffMenu(barId: string, offlineEnabled: boolean) {
  const r = await cachedFetch(barId, "staff-menu", offlineEnabled, async () => {
    const [cats, items] = await Promise.all([
      supabase.from("categories").select("*").eq("bar_id", barId).order("position"),
      supabase.from("items").select("*").eq("bar_id", barId).order("position"),
    ]);
    if (cats.error) throw cats.error;
    if (items.error) throw items.error;
    return {
      categories: (cats.data ?? []) as Category[],
      items: (items.data ?? []) as unknown as Item[],
    };
  });
  return r.data;
}

export function StaffOrderDialog({
  barId,
  tableId,
  tableNumber,
  hasSession,
  userId,
  onClose,
}: {
  barId: string;
  tableId: string;
  tableNumber: number;
  hasSession: boolean;
  userId: string;
  onClose: () => void;
}) {
  const openSession = useServerFn(openSessionForTable);
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [nickname, setNickname] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const { data: settings } = useBarSettings(barId);

  const offlineEnabled = settings?.offline_mode === true;
  const { data } = useQuery({
    queryKey: ["staff-menu", barId, offlineEnabled],
    queryFn: () => loadStaffMenu(barId, offlineEnabled),
  });
  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const { data: popData } = useMenuPopularity(barId, true);
  const popularity: Record<string, number> = popData ?? {};
  const topItems = useMemo(
    () =>
      items
        .filter((i) => i.available && (popularity[i.id] ?? 0) > 0)
        .sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0))
        .slice(0, 8),
    [items, popularity],
  );

  const mode = tapaMode(settings);
  const { data: sessionLines = [] } = useQuery({
    queryKey: ["staff-session-tapas", tableId, offlineEnabled],
    enabled: hasSession && mode !== "off",
    queryFn: async () => {
      const r = await cachedFetch(barId, `session-tapas:${tableId}`, offlineEnabled, async () => {
        const { data: ses, error } = await supabase
          .from("table_sessions")
          .select("id")
          .eq("table_id", tableId)
          .in("status", ["open", "pending"])
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!ses) return [] as SessionTapaLine[];
        const { data: ords, error: e2 } = await supabase
          .from("orders")
          .select("order_items(item_id, qty, tapa_kind, tapa_round, deleted_at)")
          .eq("session_id", ses.id);
        if (e2) throw e2;
        return (ords ?? []).flatMap((o) => o.order_items as SessionTapaLine[]);
      });
      return r.data;
    },
  });
  const priced = useMemo(() => priceCart(settings, cart, items, sessionLines), [settings, cart, items, sessionLines]);
  const drinksInCart = cartDrinks(cart, items);
  const [tapaN, setTapaN] = useState<number | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const tapaCount = tapaN ?? drinksInCart;
  const rounds = mode === "house" ? proposeRounds(tapaCount, sessionLines, forceNew) : [];
  const houseLines = mode === "house" ? houseTapaLines(settings, rounds, drinksInCart) : [];
  const allowance = mode === "choice" ? choiceAllowance(cart, items, sessionLines) : null;
  const total = pricedTotal(priced) + houseLines.reduce((s, l) => s + l.price * l.qty, 0);

  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
      const ex = prev.find((l) => l.itemId === itemId);
      if (!ex) return delta > 0 ? [...prev, { itemId, qty: 1, note: "" }] : prev;
      const qty = ex.qty + delta;
      if (qty <= 0) return prev.filter((l) => l.itemId !== itemId);
      return prev.map((l) => (l.itemId === itemId ? { ...l, qty } : l));
    });
  }

  type SendMode = "all-queue" | "all-served" | "drinks-served";

  async function send(mode: SendMode) {
    if (!cart.length) return;
    setSending(true);
    try {
      const buildLines = (withOrder: { barId: string; orderId: string } | null): Record<string, unknown>[] => {
        const now = new Date().toISOString();
        const base: Record<string, unknown>[] = priced.map((l) => {
          const it = l.item;
          const alreadyServed =
            mode === "all-served" || (mode === "drinks-served" && it.destination === "bar");
          return {
            ...(withOrder ? { bar_id: withOrder.barId, order_id: withOrder.orderId } : {}),
            item_id: it.id,
            name_snapshot: it.name,
            price_snapshot: l.price,
            tax_rate_snapshot: it.tax_rate,
            qty: l.qty,
            note: l.note.trim() || null,
            destination: it.destination,
            tapa_kind: l.tapa_kind,
            ...(alreadyServed
              ? { status: "served" as const, ready_at: now, served_at: now }
              : { status: "pending" as const }),
          };
        });
        for (const h of houseLines) {
          base.push({
            ...(withOrder ? { bar_id: withOrder.barId, order_id: withOrder.orderId } : {}),
            item_id: null,
            name_snapshot: h.name,
            price_snapshot: h.price,
            tax_rate_snapshot: 10,
            qty: h.qty,
            note: null,
            destination: "kitchen",
            status: "pending",
            tapa_kind: h.tapa_kind,
            tapa_round: h.tapa_round,
          });
        }
        return base;
      };

      if (settings?.offline_mode === true && !navigator.onLine) {
        enqueueOp({
          kind: "order",
          barId,
          tableId,
          nickname,
          userId,
          lines: buildLines(null),
          label: `Comanda de la mesa ${tableNumber}`,
        });
        toast("Comanda guardada sin conexión: se enviará sola al volver la red");
        onClose();
        return;
      }

      const res = await openSession({ data: { tableId, nickname } });
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          bar_id: res.barId,
          session_id: res.sessionId,
          created_by: userId,
          created_by_role: res.role ?? "waiter",
        })
        .select("id")
        .single();
      if (error || !order) throw error ?? new Error("orden");
      const lines = buildLines({ barId: res.barId, orderId: order.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: le } = await supabase.from("order_items").insert(lines as any);
      if (le) throw le;
      toast.success(`Comanda enviada a la mesa ${tableNumber}`);
      queryClient.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No se pudo enviar la comanda");
    } finally {
      setSending(false);
    }
  }

  const renderItem = (item: Item) => {
    const line = cart.find((l) => l.itemId === item.id);
    return (
      <li key={item.id} className={`rounded-lg border border-border p-3 ${item.available ? "bg-card" : "bg-muted opacity-60"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatEUR(Number(item.price))}
              {item.allergens?.length ? ` · ${item.allergens.map(allergenLabel).join(", ")}` : ""}
            </p>
          </div>
          {item.available ? (
            <div className="flex items-center gap-2">
              {line && (
                <button aria-label="Quitar" onClick={() => changeQty(item.id, -1)} className="rounded-full border border-border p-1.5">
                  <Minus className="h-4 w-4" />
                </button>
              )}
              {line && <span className="tabular w-5 text-center font-bold">{line.qty}</span>}
              <button aria-label={`Añadir ${item.name}`} onClick={() => changeQty(item.id, 1)} className="rounded-full bg-primary p-1.5 text-primary-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">Agotado</span>
          )}
        </div>
        {line && (
          <Input
            className="mt-2"
            placeholder="Nota (ej. sin cebolla)"
            value={line.note}
            onChange={(e) =>
              setCart((p) => p.map((l) => (l.itemId === item.id ? { ...l, note: e.target.value } : l)))
            }
          />
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-bold">Añadir comanda · {tableLabel(tableNumber)}</h2>
        <button aria-label="Cerrar" onClick={onClose} className="rounded-md border border-border p-2">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasSession && (
          <Input className="mb-4" placeholder="Apodo de la mesa (opcional)" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        )}
        {topItems.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Lo más pedido</p>
            <div className="flex flex-wrap gap-1.5">
              {topItems.map((it) => {
                const q = cart.find((l) => l.itemId === it.id)?.qty;
                return (
                  <button
                    key={it.id}
                    onClick={() => changeQty(it.id, 1)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${q ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                  >
                    {q ? `${q}× ` : "+ "}{it.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <MenuBrowser
          categories={categories}
          sort={settings?.menu_sort ?? "alpha"}
          items={items.filter((i) => i.available)}
          cart={cart}
          favKey={`comandas:staff-favs:${barId}`}
          tapaChoice={mode === "choice"}
          onQty={changeQty}
          onNote={(itemId, note) => setCart((p) => p.map((l) => (l.itemId === itemId ? { ...l, note } : l)))}
        />
      </div>
      <footer className="border-t border-border bg-card px-4 py-3">
        {confirming ? (
          <div className="space-y-2">
            {(() => {
              const destOf = (l: CartLine) => items.find((i) => i.id === l.itemId)?.destination ?? "kitchen";
              const barLines = cart.filter((l) => destOf(l) === "bar");
              const kitchenLines = cart.filter((l) => destOf(l) !== "bar");
              const mixed = barLines.length > 0 && kitchenLines.length > 0;
              const renderGroup = (title: string | null, lines: CartLine[]) => (
                <div key={title ?? "all"}>
                  {title && <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>}
                  <ul className="text-sm">
                    {lines.map((l) => {
                      const it = items.find((i) => i.id === l.itemId);
                      return (
                        <li key={l.itemId} className="flex justify-between">
                          <span>{l.qty}× {it?.name}{l.note ? ` (${l.note})` : ""}</span>
                          <button onClick={() => setCart((p) => p.filter((x) => x.itemId !== l.itemId))} className="text-xs text-destructive">Eliminar</button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
              return (
                <>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {mixed ? (
                      <>
                        {renderGroup("🍺 Barra / Bebidas", barLines)}
                        {renderGroup("🍳 Cocina / Comida", kitchenLines)}
                      </>
                    ) : (
                      renderGroup(null, cart)
                    )}
                  </div>
                  {mode === "house" && (drinksInCart > 0 || tapaCount > 0) && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Tapas para cocina</span>
                        <div className="flex items-center gap-2">
                          <button aria-label="Menos tapas" onClick={() => setTapaN(Math.max(0, tapaCount - 1))} className="rounded-full border border-border p-1"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="tabular w-5 text-center font-bold">{tapaCount}</span>
                          <button aria-label="Más tapas" onClick={() => setTapaN(tapaCount + 1)} className="rounded-full border border-border p-1"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <ul className="mt-1">
                        {houseLines.map((h) => (
                          <li key={h.name} className="flex justify-between">
                            <span>{h.qty}× {roundLabel(settings, h.tapa_round)}{h.tapa_kind === "extra" ? " (extra)" : ""}</span>
                            <span className="text-muted-foreground">{h.price ? formatEUR(h.price * h.qty) : "incluida"}</span>
                          </li>
                        ))}
                      </ul>
                      <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={forceNew} onChange={(e) => setForceNew(e.target.checked)} />
                        Empezar ronda nueva (no completar la anterior)
                      </label>
                    </div>
                  )}
                  {mode === "choice" && allowance && allowance.drinks > 0 && (
                    <p className="rounded-lg bg-primary/5 p-2 text-sm">
                      Tapas incluidas: {Math.min(allowance.drinks, allowance.used + priced.filter((l) => l.tapa_kind).reduce((a, l) => a + l.qty, 0))} de {allowance.drinks} bebidas
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(false)} className="rounded-lg border border-border px-3 py-2.5 font-semibold">Volver</button>
                    {mixed ? (
                      <>
                        <button disabled={sending} onClick={() => send("drinks-served")} className="flex-1 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50">
                          {sending ? "Enviando…" : "Servir bebidas y enviar cocina"}
                        </button>
                        <button disabled={sending} onClick={() => send("all-queue")} className="flex-1 rounded-lg border border-border py-2.5 font-semibold disabled:opacity-50">
                          Enviar todo a preparar
                        </button>
                        <button disabled={sending} onClick={() => send("all-served")} className="flex-1 rounded-lg bg-success py-2.5 font-semibold text-success-foreground disabled:opacity-50">
                          Ya servido todo
                        </button>
                      </>
                    ) : (
                      <>
                        <button disabled={sending || !cart.length} onClick={() => send("all-queue")} className="flex-1 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50">
                          {sending ? "Enviando…" : "Enviar a preparar"}
                        </button>
                        <button disabled={sending || !cart.length} onClick={() => send("all-served")} className="flex-1 rounded-lg bg-success py-2.5 font-semibold text-success-foreground disabled:opacity-50">
                          Ya servido
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {mixed
                      ? "\"Servir bebidas y enviar cocina\": las bebidas quedan servidas al momento y la comida va a la cola de cocina."
                      : "\"Ya servido\": para lo que pones al momento (una caña, un café). Se cobra igual pero no va a la cola."}
                  </p>
                </>
              );
            })()}
          </div>
        ) : (
          <button disabled={!cart.length} onClick={() => setConfirming(true)} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
            Enviar comanda · {formatEUR(total)}
          </button>
        )}
      </footer>
    </div>
  );
}
