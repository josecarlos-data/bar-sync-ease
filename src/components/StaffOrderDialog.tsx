import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openSessionForTable } from "@/lib/bar.functions";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { MenuBrowser } from "@/components/MenuBrowser";
import { Input } from "@/components/ui/input";
import type { Category, Item } from "@/lib/types";

type CartLine = { itemId: string; qty: number; note: string };

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

  const { data } = useQuery({
    queryKey: ["staff-menu", barId],
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from("categories").select("*").eq("bar_id", barId).order("position"),
        supabase.from("items").select("*").eq("bar_id", barId).order("position"),
      ]);
      return {
        categories: (cats.data ?? []) as Category[],
        items: (items.data ?? []) as unknown as Item[],
      };
    },
  });
  const items = data?.items ?? [];
  const categories = data?.categories ?? [];

  const total = useMemo(
    () =>
      cart.reduce((s, l) => {
        const it = items.find((i) => i.id === l.itemId);
        return s + (it ? Number(it.price) * l.qty : 0);
      }, 0),
    [cart, items],
  );

  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
      const ex = prev.find((l) => l.itemId === itemId);
      if (!ex) return delta > 0 ? [...prev, { itemId, qty: 1, note: "" }] : prev;
      const qty = ex.qty + delta;
      if (qty <= 0) return prev.filter((l) => l.itemId !== itemId);
      return prev.map((l) => (l.itemId === itemId ? { ...l, qty } : l));
    });
  }

  async function send() {
    if (!cart.length) return;
    setSending(true);
    try {
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
      const lines = cart.map((l) => {
        const it = items.find((i) => i.id === l.itemId)!;
        return {
          bar_id: res.barId,
          order_id: order.id,
          item_id: it.id,
          name_snapshot: it.name,
          price_snapshot: it.price,
          tax_rate_snapshot: it.tax_rate,
          qty: l.qty,
          note: l.note.trim() || null,
          destination: it.destination,
        };
      });
      const { error: le } = await supabase.from("order_items").insert(lines);
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
        <h2 className="font-display text-lg font-bold">Añadir comanda · Mesa {tableNumber}</h2>
        <button aria-label="Cerrar" onClick={onClose} className="rounded-md border border-border p-2">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasSession && (
          <Input className="mb-4" placeholder="Apodo de la mesa (opcional)" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        )}
        <MenuBrowser
          categories={categories}
          items={items.filter((i) => i.available)}
          cart={cart}
          favKey={`comandas:staff-favs:${barId}`}
          onQty={changeQty}
          onNote={(itemId, note) => setCart((p) => p.map((l) => (l.itemId === itemId ? { ...l, note } : l)))}
        />
      </div>
      <footer className="border-t border-border bg-card px-4 py-3">
        {confirming ? (
          <div className="space-y-2">
            <ul className="max-h-40 overflow-y-auto text-sm">
              {cart.map((l) => {
                const it = items.find((i) => i.id === l.itemId);
                return (
                  <li key={l.itemId} className="flex justify-between">
                    <span>{l.qty}× {it?.name}{l.note ? ` (${l.note})` : ""}</span>
                    <button onClick={() => setCart((p) => p.filter((x) => x.itemId !== l.itemId))} className="text-xs text-destructive">Eliminar</button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-border py-2.5 font-semibold">Volver</button>
              <button disabled={sending || !cart.length} onClick={send} className="flex-1 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50">
                {sending ? "Enviando…" : "Confirmar"}
              </button>
            </div>
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
