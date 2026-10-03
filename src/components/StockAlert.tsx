import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { playAlert } from "@/lib/alertSound";
import { Input } from "@/components/ui/input";

export type StockPool = {
  id: string;
  bar_id: string;
  name: string;
  unit_label: string;
  quantity: number;
  low_threshold: number;
  status: "open" | "confirm_pending" | "depleted";
};

export function useStockPools(barId: string | null | undefined) {
  useRealtime(`stock-${barId}`, ["stock_pools"], !!barId);
  return useQuery({
    queryKey: ["stock-pools", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_pools")
        .select("*")
        .eq("bar_id", barId!)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, quantity: Number(p.quantity), low_threshold: Number(p.low_threshold) })) as StockPool[];
    },
  });
}

export async function stockAction(poolId: string, action: string, qty = 0) {
  const { error } = await supabase.rpc("stock_action", { _pool: poolId, _action: action, _qty: qty });
  if (error) {
    toast.error("No se pudo actualizar el stock");
    return false;
  }
  return true;
}

/** Ventana de confirmación cuando, según los pedidos, una olla/artículo llega a cero. */
export function StockAlert({ barId }: { barId: string | null | undefined }) {
  const { data: pools } = useStockPools(barId);
  const qc = useQueryClient();
  const pending = (pools ?? []).filter((p) => p.status === "confirm_pending");
  const current = pending[0];
  const [custom, setCustom] = useState("");
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (current && seen.current !== current.id) {
      seen.current = current.id;
      playAlert();
    }
  }, [current]);

  if (!current) return null;

  async function act(action: string, qty = 0) {
    if (await stockAction(current!.id, action, qty)) {
      setCustom("");
      qc.invalidateQueries({ queryKey: ["stock-pools"] });
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-warning bg-card p-4 shadow-2xl">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="font-display text-lg font-bold">
          {current.name}: según los pedidos se ha acabado. ¿Es así?
        </p>
        {pending.length > 1 && (
          <p className="text-xs text-muted-foreground">{pending.length - 1} aviso(s) más en cola</p>
        )}
        <button
          onClick={() => act("deplete")}
          className="w-full rounded-lg bg-destructive py-3 font-bold text-destructive-foreground"
        >
          Sí, agotar
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Aún queda:</span>
          {[1, 2, 5].map((n) => (
            <button key={n} onClick={() => act("keep", n)} className="rounded-md border border-border px-3 py-2 font-bold">
              {n}
            </button>
          ))}
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Otra"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-20"
          />
          <button
            disabled={!(Number(custom) > 0)}
            onClick={() => act("keep", Number(custom))}
            className="rounded-md bg-primary px-3 py-2 font-bold text-primary-foreground disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
