import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStockPools, type StockPool } from "@/components/StockAlert";
import { Input } from "@/components/ui/input";

export type ItemStockLink = { id: string; pool_id: string | null; pool_portions: number };

/** Vínculos plato → existencia de todo el bar (para mostrar el stock en la carta). */
export function useItemStockLinks(barId: string | null | undefined) {
  return useQuery({
    queryKey: ["item-stock-links", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.from("items").select("id, pool_id, pool_portions").eq("bar_id", barId!);
      return (data ?? []) as ItemStockLink[];
    },
  });
}

export function stockLabel(p: StockPool | undefined) {
  if (!p) return null;
  if (p.status === "depleted") return { text: "Agotado", tone: "text-destructive" };
  if (p.quantity <= p.low_threshold) return { text: `Quedan ${p.quantity}`, tone: "text-warning" };
  return { text: `Quedan ${p.quantity}`, tone: "text-muted-foreground" };
}

/** Insignia pequeña junto al plato en Artículos. */
export function ItemStockBadge({ pool }: { pool: StockPool | undefined }) {
  const l = stockLabel(pool);
  if (!l) return null;
  return <span className={`text-xs font-semibold ${l.tone}`}>· {l.text}</span>;
}

/** Bloque «Existencias» dentro del editor del plato. */
export function ItemStockEditor({
  barId,
  itemId,
  itemName,
}: {
  barId: string;
  itemId: string;
  itemName: string;
}) {
  const qc = useQueryClient();
  const { data: pools } = useStockPools(barId);
  const { data: links } = useItemStockLinks(barId);
  const link = links?.find((l) => l.id === itemId);
  const pool = pools?.find((p) => p.id === link?.pool_id);

  async function setLink(poolId: string | null, portions = 1) {
    const { error } = await supabase.from("items").update({ pool_id: poolId, pool_portions: portions }).eq("id", itemId);
    if (error) toast.error("No se pudo guardar");
    qc.invalidateQueries();
  }
  async function byUnits() {
    const { data, error } = await supabase
      .from("stock_pools")
      .insert({ bar_id: barId, name: itemName, unit_label: "uds.", quantity: 0 })
      .select("id")
      .single();
    if (error || !data) return toast.error("No se pudo crear la existencia");
    await setLink(data.id, 1);
    toast.success("Existencia creada: pon la cantidad en Existencias");
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">Existencias</p>
      {pool ? (
        <>
          <p className="text-sm">
            Gasta de <b>{pool.name}</b> · {stockLabel(pool)?.text} {pool.unit_label}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-muted-foreground">Porciones por unidad pedida</span>
            <Input
              type="number"
              inputMode="decimal"
              className="w-20"
              defaultValue={link?.pool_portions ?? 1}
              onBlur={(e) => Number(e.target.value) > 0 && setLink(pool.id, Number(e.target.value))}
            />
          </div>
          <button type="button" onClick={() => setLink(null)} className="text-xs font-semibold text-destructive">
            Dejar de controlar existencias
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Sin control de existencias.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={byUnits} className="rounded-md border border-border px-2 py-1.5 text-sm font-semibold">
              Contar por unidades
            </button>
            <select
              className="flex-1 rounded-md border border-border bg-background p-1.5 text-sm"
              value=""
              onChange={(e) => e.target.value && setLink(e.target.value, 1)}
            >
              <option value="">Gastar de una olla…</option>
              {(pools ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
