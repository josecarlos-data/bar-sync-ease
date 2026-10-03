import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { useStockPools, stockAction, type StockPool } from "@/components/StockAlert";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/existencias")({
  head: () => ({
    meta: [
      { title: "Existencias — Comandas de bar" },
      { name: "description", content: "Stock estimado de ollas y artículos, con ajuste rápido y agotado." },
    ],
  }),
  component: StockPage,
});

type Filter = "all" | "low" | "depleted";

function StockPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const isAdmin = staff?.roles.includes("admin") ?? false;
  const qc = useQueryClient();
  const { data: pools } = useStockPools(barId);
  const { data: settings } = useBarSettings(barId);
  const [filter, setFilter] = useState<Filter>("all");
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");

  const { data: items } = useQuery({
    queryKey: ["stock-items", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, pool_id, pool_portions")
        .eq("bar_id", barId!)
        .order("name");
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries();

  const list = (pools ?? []).filter((p) =>
    filter === "all" ? true : filter === "depleted" ? p.status === "depleted" : p.status !== "depleted" && p.quantity <= p.low_threshold,
  );

  async function createPool() {
    const name = newName.trim();
    if (!name || !barId) return;
    const { error } = await supabase
      .from("stock_pools")
      .insert({ bar_id: barId, name, quantity: Number(newQty) || 0 });
    if (error) return toast.error("No se pudo crear");
    setNewName("");
    setNewQty("");
    refresh();
  }

  async function setZeroAction(v: "confirm" | "auto") {
    await supabase.from("bar_settings").update({ stock_zero_action: v } as never).eq("bar_id", barId!);
    refresh();
  }

  const zeroAction = (settings as unknown as { stock_zero_action?: string } | null)?.stock_zero_action ?? "confirm";

  return (
    <StaffShell title="Existencias">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El stock es una estimación: corrígelo cuando haga falta. Baja solo con cada pedido y vuelve si se elimina una línea.
        </p>

        {isAdmin && (
          <section className="space-y-3 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">Al acabarse el stock</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  ["confirm", "Preguntar al personal"],
                  ["auto", "Agotar automáticamente"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setZeroAction(v)}
                    className={`rounded-md border px-2 py-2 text-sm font-semibold ${zeroAction === v ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nueva olla o artículo (p. ej. Carne en salsa)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="number" placeholder="Cant." className="w-20" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              <button onClick={createPool} className="rounded-md bg-primary px-3 font-bold text-primary-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <div className="flex gap-2">
          {([
            ["all", "Todo"],
            ["low", "Queda poco"],
            ["depleted", "Agotados"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {pools?.length ? "Nada en este filtro." : isAdmin ? "Crea tu primera olla o artículo con stock arriba." : "Aún no hay stock configurado."}
          </p>
        )}

        <ul className="space-y-3">
          {list.map((p) => (
            <PoolCard
              key={p.id}
              pool={p}
              isAdmin={isAdmin}
              items={items ?? []}
              onChange={refresh}
            />
          ))}
        </ul>
      </div>
    </StaffShell>
  );
}

function PoolCard({
  pool,
  isAdmin,
  items,
  onChange,
}: {
  pool: StockPool;
  isAdmin: boolean;
  items: { id: string; name: string; pool_id: string | null; pool_portions: number }[];
  onChange: () => void;
}) {
  const [refill, setRefill] = useState("");
  const linked = items.filter((i) => i.pool_id === pool.id);
  const free = items.filter((i) => !i.pool_id);
  const low = pool.status !== "depleted" && pool.quantity <= pool.low_threshold;

  async function act(a: string, q = 0) {
    if (await stockAction(pool.id, a, q)) onChange();
  }
  async function link(itemId: string, poolId: string | null, portions = 1) {
    await supabase.from("items").update({ pool_id: poolId, pool_portions: portions }).eq("id", itemId);
    onChange();
  }
  async function remove() {
    if (!confirm(`¿Borrar "${pool.name}"? Los artículos dejan de controlar stock.`)) return;
    await supabase.from("stock_pools").delete().eq("id", pool.id);
    onChange();
  }

  const pct = Math.max(0, Math.min(100, (pool.quantity / Math.max(pool.low_threshold * 4, pool.quantity, 1)) * 100));

  return (
    <li className={`space-y-3 rounded-lg border p-3 ${pool.status === "depleted" ? "border-border bg-muted opacity-70" : low ? "border-warning bg-card" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{pool.name}</p>
          <p className="text-sm">
            {pool.status === "depleted" ? (
              <span className="font-bold text-destructive">Agotado</span>
            ) : (
              <>
                Quedan <b>{pool.quantity}</b> {pool.unit_label}
                {pool.status === "confirm_pending" && <span className="ml-2 font-bold text-warning">· por confirmar</span>}
                {low && pool.status === "open" && <span className="ml-2 font-bold text-warning">· queda poco</span>}
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <button onClick={remove} aria-label="Borrar" className="p-1 text-muted-foreground">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${low ? "bg-warning" : "bg-primary"}`} style={{ width: `${pool.status === "depleted" ? 0 : pct}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => act("adjust", -1)} className="rounded-md border border-border p-2" aria-label="Restar uno">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={() => act("adjust", 1)} className="rounded-md border border-border p-2" aria-label="Sumar uno">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={() => act("keep", Math.max(1, Math.round(pool.quantity / 2)))} className="rounded-md border border-border px-2 py-2 text-sm font-semibold">
          Queda la mitad
        </button>
        <button onClick={() => act("keep", Math.min(pool.low_threshold, Math.max(1, pool.quantity)))} className="rounded-md border border-border px-2 py-2 text-sm font-semibold">
          Queda poco
        </button>
        {pool.status === "depleted" ? (
          <button onClick={() => act("reopen", Math.max(pool.quantity, 1))} className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
            Reabrir
          </button>
        ) : (
          <button onClick={() => act("deplete")} className="rounded-md bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">
            Agotar
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Input type="number" inputMode="decimal" placeholder="Nueva olla / reposición: cantidad" value={refill} onChange={(e) => setRefill(e.target.value)} />
        <button
          disabled={!(Number(refill) > 0)}
          onClick={() => { act("refill", Number(refill)); setRefill(""); }}
          className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Recargar
        </button>
      </div>

      {isAdmin && (
        <div className="space-y-2 border-t border-border pt-2">
          <p className="text-xs font-semibold text-muted-foreground">Artículos que gastan de aquí (porciones por unidad pedida)</p>
          {linked.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{i.name}</span>
              <Input
                type="number"
                className="w-20"
                defaultValue={i.pool_portions}
                onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== Number(i.pool_portions) && link(i.id, pool.id, Number(e.target.value))}
              />
              <button onClick={() => link(i.id, null)} className="text-xs text-destructive">Quitar</button>
            </div>
          ))}
          <select
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            value=""
            onChange={(e) => e.target.value && link(e.target.value, pool.id, 1)}
          >
            <option value="">+ Vincular artículo…</option>
            {free.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}
