import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, Trash2, History } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { useStockPools, stockAction, type StockPool } from "@/components/StockAlert";
import { PurchaseList, usePurchaseItems } from "@/components/PurchaseList";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/existencias")({
  head: () => ({
    meta: [
      { title: "Existencias y compra — Comandas de bar" },
      { name: "description", content: "Stock ligado a la carta y lista de la compra que se rellena sola." },
    ],
  }),
  component: StockPage,
});

type Filter = "all" | "low" | "depleted";
type StockItem = { id: string; name: string; pool_id: string | null; pool_portions: number; category_id: string | null; available: boolean };

function StockPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const isAdmin = staff?.roles.includes("admin") ?? false;
  const qc = useQueryClient();
  const { data: pools } = useStockPools(barId);
  const { data: settings } = useBarSettings(barId);
  const listOn = !!(settings as unknown as { purchase_list_enabled?: boolean } | null)?.purchase_list_enabled;
  const { data: purchases } = usePurchaseItems(listOn ? barId : null);
  const [tab, setTab] = useState<"stock" | "buy">("stock");
  const [filter, setFilter] = useState<Filter>("all");
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");

  const { data: items } = useQuery({
    queryKey: ["stock-items", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, pool_id, pool_portions, category_id, available")
        .eq("bar_id", barId!)
        .order("name");
      return (data ?? []) as StockItem[];
    },
  });
  const { data: categories } = useQuery({
    queryKey: ["stock-cats", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("bar_id", barId!).order("position");
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries();
  const isLow = (p: StockPool) => p.status !== "depleted" && p.quantity <= p.low_threshold;
  const pendingBuy = (purchases ?? []).filter((p) => p.status === "pending");

  const list = (pools ?? []).filter((p) => {
    if (filter === "depleted" && p.status !== "depleted") return false;
    if (filter === "low" && !isLow(p)) return false;
    const linked = (items ?? []).filter((i) => i.pool_id === p.id);
    if (cat && !linked.some((i) => i.category_id === cat)) return false;
    const s = q.trim().toLowerCase();
    if (s && !p.name.toLowerCase().includes(s) && !linked.some((i) => i.name.toLowerCase().includes(s))) return false;
    return true;
  });

  async function createPool() {
    const name = newName.trim();
    if (!name || !barId) return;
    const { error } = await supabase.from("stock_pools").insert({ bar_id: barId, name, quantity: Number(newQty) || 0 });
    if (error) { toast.error("No se pudo crear"); return; }
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
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Agotados" value={(pools ?? []).filter((p) => p.status === "depleted").length} onClick={() => { setTab("stock"); setFilter("depleted"); }} />
          <Stat label="Queda poco" value={(pools ?? []).filter(isLow).length} onClick={() => { setTab("stock"); setFilter("low"); }} />
          <Stat label="Por comprar" value={listOn ? pendingBuy.length : "—"} onClick={() => listOn && setTab("buy")} />
        </div>

        {listOn && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {([["stock", "Existencias"], ["buy", "Lista de la compra"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={`rounded-md py-2 text-sm font-semibold ${tab === v ? "bg-card shadow" : ""}`}>{l}</button>
            ))}
          </div>
        )}

        {tab === "buy" && listOn && barId ? (
          <PurchaseList barId={barId} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ligado a la carta: baja con cada pedido, al agotarse el plato sale de la carta y al recargar vuelve.
              {listOn && " Lo que baja del mínimo entra solo en la lista de la compra."}
            </p>

            {isAdmin && (
              <section className="space-y-3 rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold">Al acabarse el stock</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([["confirm", "Preguntar al personal"], ["auto", "Agotar automáticamente"]] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setZeroAction(v)}
                        className={`rounded-md border px-2 py-2 text-sm font-semibold ${zeroAction === v ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nueva olla o producto (p. ej. Carne en salsa)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <Input type="number" placeholder="Cant." className="w-20" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                  <button onClick={createPool} className="rounded-md bg-primary px-3 font-bold text-primary-foreground" aria-label="Crear">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            <div className="flex gap-2">
              <Input placeholder="Buscar producto o plato" value={q} onChange={(e) => setQ(e.target.value)} />
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Toda la carta</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              {([["all", "Todo"], ["low", "Queda poco"], ["depleted", "Agotados"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setFilter(v)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {label}
                </button>
              ))}
            </div>

            {list.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {pools?.length ? "Nada en este filtro." : isAdmin ? "Crea una olla arriba, o en Artículos pulsa «Contar por unidades» en un plato." : "Aún no hay stock configurado."}
              </p>
            )}

            <ul className="space-y-3">
              {list.map((p) => (
                <PoolCard key={p.id} pool={p} isAdmin={isAdmin} items={items ?? []} inList={pendingBuy.some((b) => b.pool_id === p.id)} onChange={refresh} />
              ))}
            </ul>
          </>
        )}
      </div>
    </StaffShell>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number | string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-border bg-card p-2">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

const REASONS: Record<string, string> = {
  order: "Pedido", sale: "Pedido", manual: "Ajuste", waste: "Merma", refill: "Recarga", confirm: "Corrección", reopen: "Reabierto", deplete: "Agotado", cancel: "Línea anulada",
};

function PoolHistory({ poolId }: { poolId: string }) {
  const { data } = useQuery({
    queryKey: ["stock-moves", poolId],
    queryFn: async () => {
      const { data } = await supabase.from("stock_movements").select("id, delta, reason, created_at").eq("pool_id", poolId).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
  });
  if (!data?.length) return <p className="text-xs text-muted-foreground">Sin movimientos.</p>;
  return (
    <ul className="space-y-0.5 text-xs">
      {data.map((m) => (
        <li key={m.id} className="flex justify-between">
          <span>{new Date(m.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {REASONS[m.reason] ?? m.reason}</span>
          <b className={Number(m.delta) < 0 ? "text-destructive" : ""}>{Number(m.delta) > 0 ? "+" : ""}{Number(m.delta)}</b>
        </li>
      ))}
    </ul>
  );
}

function PoolCard({ pool, isAdmin, items, inList, onChange }: {
  pool: StockPool & { target_qty?: number; supplier?: string };
  isAdmin: boolean;
  items: StockItem[];
  inList: boolean;
  onChange: () => void;
}) {
  const [refill, setRefill] = useState("");
  const [showHist, setShowHist] = useState(false);
  const [restock, setRestock] = useState(false);
  const [rQty, setRQty] = useState("");
  const [rPrice, setRPrice] = useState("");
  const [rSupplier, setRSupplier] = useState(pool.supplier ?? "");
  const linked = items.filter((i) => i.pool_id === pool.id);
  const free = items.filter((i) => !i.pool_id);
  const low = pool.status !== "depleted" && pool.quantity <= pool.low_threshold;

  async function doRestock() {
    const qty = Number(rQty);
    if (!(qty > 0)) return;
    const { error } = await supabase.rpc("restock_pool", {
      _pool: pool.id,
      _qty: qty,
      _price: Number(rPrice) || 0,
      _supplier: rSupplier.trim(),
    });
    if (error) { toast.error("No se pudo reponer"); return; }
    toast.success(`${pool.name}: +${qty} ${pool.unit_label}`);
    setRestock(false); setRQty(""); setRPrice("");
    onChange();
  }

  async function act(a: string, q = 0) {
    if (await stockAction(pool.id, a, q)) onChange();
  }
  async function link(itemId: string, poolId: string | null, portions = 1) {
    await supabase.from("items").update({ pool_id: poolId, pool_portions: portions }).eq("id", itemId);
    onChange();
  }
  async function patch(v: Record<string, unknown>) {
    const { error } = await supabase.from("stock_pools").update(v as never).eq("id", pool.id);
    if (error) toast.error("No se pudo guardar");
    onChange();
  }
  async function remove() {
    if (!confirm(`¿Borrar "${pool.name}"? Los platos dejan de controlar stock.`)) return;
    await supabase.from("stock_pools").delete().eq("id", pool.id);
    onChange();
  }

  const pct = Math.max(0, Math.min(100, (pool.quantity / Math.max(Number(pool.target_qty) || 0, pool.low_threshold * 4, pool.quantity, 1)) * 100));

  return (
    <li className={`space-y-3 rounded-lg border p-3 ${pool.status === "depleted" ? "border-border bg-muted opacity-80" : low ? "border-warning bg-card" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{pool.name}</p>
          <p className="text-sm">
            {pool.status === "depleted" ? (
              <span className="font-bold text-destructive">Agotado · fuera de la carta</span>
            ) : (
              <>
                Quedan <b>{pool.quantity}</b> {pool.unit_label}
                {pool.status === "confirm_pending" && <span className="ml-2 font-bold text-warning">· por confirmar</span>}
                {low && pool.status === "open" && <span className="ml-2 font-bold text-warning">· queda poco</span>}
              </>
            )}
            {inList && <span className="ml-2 rounded bg-muted px-1.5 text-xs font-semibold">En la compra</span>}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowHist(!showHist)} aria-label="Historial" className="p-1 text-muted-foreground"><History className="h-4 w-4" /></button>
          {isAdmin && <button onClick={remove} aria-label="Borrar" className="p-1 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${low ? "bg-warning" : "bg-primary"}`} style={{ width: `${pool.status === "depleted" ? 0 : pct}%` }} />
      </div>
      {showHist && <PoolHistory poolId={pool.id} />}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => act("adjust", -1)} className="rounded-md border border-border p-2" aria-label="Restar uno"><Minus className="h-4 w-4" /></button>
        <button onClick={() => act("adjust", 1)} className="rounded-md border border-border p-2" aria-label="Sumar uno"><Plus className="h-4 w-4" /></button>
        <button onClick={() => act("keep", Math.max(1, Math.round(pool.quantity / 2)))} className="rounded-md border border-border px-2 py-2 text-sm font-semibold">Queda la mitad</button>
        <button onClick={() => act("keep", Math.min(pool.low_threshold, Math.max(1, pool.quantity)))} className="rounded-md border border-border px-2 py-2 text-sm font-semibold">Queda poco</button>
        {pool.status === "depleted" ? (
          <button onClick={() => act("reopen", Math.max(pool.quantity, 1))} className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Reabrir</button>
        ) : (
          <button onClick={() => act("deplete")} className="rounded-md bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">Agotar</button>
        )}
      </div>
      <div className="flex gap-2">
        <Input type="number" inputMode="decimal" placeholder="Recarga: cantidad total" value={refill} onChange={(e) => setRefill(e.target.value)} />
        <button disabled={!(Number(refill) > 0)} onClick={() => { act("refill", Number(refill)); setRefill(""); }}
          className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Recargar</button>
      </div>

      <div className="space-y-1 border-t border-border pt-2">
        <p className="text-xs font-semibold text-muted-foreground">En la carta</p>
        {linked.length === 0 && <p className="text-xs text-muted-foreground">Ningún plato gasta de aquí.</p>}
        {linked.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{i.name}{!i.available && <span className="ml-1 text-xs text-destructive">· no disponible</span>}</span>
            {isAdmin && (
              <>
                <Input type="number" className="w-16" defaultValue={i.pool_portions} aria-label="Porciones"
                  onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== Number(i.pool_portions) && link(i.id, pool.id, Number(e.target.value))} />
                <button onClick={() => link(i.id, null)} className="text-xs text-destructive">Quitar</button>
              </>
            )}
          </div>
        ))}
        {isAdmin && (
          <select className="w-full rounded-md border border-border bg-background p-2 text-sm" value="" onChange={(e) => e.target.value && link(e.target.value, pool.id, 1)}>
            <option value="">+ Añadir plato de la carta…</option>
            {free.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs">
          <label className="space-y-1"><span className="text-muted-foreground">Mínimo</span>
            <Input type="number" defaultValue={pool.low_threshold} onBlur={(e) => Number(e.target.value) !== pool.low_threshold && patch({ low_threshold: Number(e.target.value) || 0 })} /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Ideal</span>
            <Input type="number" defaultValue={Number(pool.target_qty) || ""} onBlur={(e) => patch({ target_qty: Number(e.target.value) || 0 })} /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Unidad</span>
            <Input defaultValue={pool.unit_label} onBlur={(e) => e.target.value !== pool.unit_label && patch({ unit_label: e.target.value })} /></label>
          <label className="col-span-3 space-y-1"><span className="text-muted-foreground">Proveedor</span>
            <Input defaultValue={pool.supplier ?? ""} placeholder="p. ej. Makro, Cervezas Alhambra" onBlur={(e) => e.target.value !== (pool.supplier ?? "") && patch({ supplier: e.target.value })} /></label>
        </div>
      )}
    </li>
  );
}
