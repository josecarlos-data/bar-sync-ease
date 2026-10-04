import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MenuBrowser } from "@/components/MenuBrowser";
import { useBarSettings } from "@/hooks/useStaff";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/allergens";
import type { Category, Item } from "@/lib/types";

type CartLine = { itemId: string; qty: number; note: string };

/**
 * Apunta artículos a una cuenta de fiado. No abre comanda de mesa: solo
 * registra la línea, y las existencias se descuentan con el mismo control
 * que una comanda normal.
 */
export function TabLineDialog({
  barId,
  tabId,
  tabName,
  userId,
  onClose,
}: {
  barId: string;
  tabId: string;
  tabName: string;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sending, setSending] = useState(false);
  const { data: settings } = useBarSettings(barId);

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

  function setNote(itemId: string, note: string) {
    setCart((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)));
  }

  async function save() {
    if (!cart.length) return;
    setSending(true);
    try {
      const rows = cart.map((l) => {
        const it = items.find((i) => i.id === l.itemId)!;
        return {
          bar_id: barId,
          tab_id: tabId,
          item_id: it.id,
          name_snapshot: it.name,
          price_snapshot: it.price,
          tax_rate_snapshot: it.tax_rate,
          qty: l.qty,
          note: l.note.trim(),
          created_by: userId,
        };
      });
      const { error } = await supabase.from("customer_tab_lines").insert(rows);
      if (error) throw error;
      toast.success(`Apuntado a ${tabName}`);
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No se pudo apuntar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-card sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-xl font-bold">Apuntar a la cuenta</h2>
            <p className="text-sm text-muted-foreground">{tabName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <MenuBrowser
            categories={categories}
            items={items}
            cart={cart}
            onQty={changeQty}
            onNote={setNote}
            showPrices
            favKey={`favs:tab:${barId}`}
            sort={settings?.menu_sort === "popular" ? "popular" : "alpha"}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-lg font-bold">{formatEUR(total)}</p>
          <Button onClick={save} disabled={!cart.length || sending}>
            {sending ? "Apuntando…" : `Apuntar ${cart.reduce((s, l) => s + l.qty, 0)} a la cuenta`}
          </Button>
        </div>
      </div>
    </div>
  );
}
