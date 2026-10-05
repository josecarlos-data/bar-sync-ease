import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Printer, Share2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Input } from "@/components/ui/input";

export type PurchaseItem = {
  id: string;
  pool_id: string | null;
  name: string;
  qty: number;
  unit_label: string;
  supplier: string;
  status: "pending" | "bought";
  auto: boolean;
  bought_at: string | null;
};

export function usePurchaseItems(barId: string | null | undefined) {
  useRealtime(`purchase-${barId}`, ["purchase_items"], !!barId);
  return useQuery({
    queryKey: ["purchase-items", barId],
    enabled: !!barId,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("bar_id", barId!)
        .or(`status.eq.pending,bought_at.gte.${since}`)
        .order("created_at");
      return (data ?? []).map((d) => ({ ...d, qty: Number(d.qty) })) as PurchaseItem[];
    },
  });
}

function listText(items: PurchaseItem[]) {
  const groups = new Map<string, PurchaseItem[]>();
  for (const i of items) groups.set(i.supplier || "Sin proveedor", [...(groups.get(i.supplier || "Sin proveedor") ?? []), i]);
  return [...groups].map(([s, l]) => `*${s}*\n${l.map((i) => `- ${i.qty} ${i.unit_label} ${i.name}`.replace(/\s+/g, " ")).join("\n")}`).join("\n\n");
}

export function PurchaseList({ barId }: { barId: string }) {
  const qc = useQueryClient();
  const { data } = usePurchaseItems(barId);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const pending = (data ?? []).filter((i) => i.status === "pending");
  const bought = (data ?? []).filter((i) => i.status === "bought").reverse();
  const bySupplier = new Map<string, PurchaseItem[]>();
  for (const i of pending) bySupplier.set(i.supplier || "Sin proveedor", [...(bySupplier.get(i.supplier || "Sin proveedor") ?? []), i]);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("purchase_items").insert({ bar_id: barId, name: name.trim(), qty: Number(qty) || 1 });
    if (error) { toast.error("No se pudo añadir"); return; }
    setName(""); setQty("");
    qc.invalidateQueries({ queryKey: ["purchase-items", barId] });
  }
  async function markBought(i: PurchaseItem, q: number, price = 0) {
    if (i.pool_id) {
      const { error } = await supabase.rpc("restock_pool", { _pool: i.pool_id, _qty: q, _price: price, _supplier: i.supplier });
      if (error) { toast.error("No se pudo marcar"); return; }
    } else {
      const { error } = await supabase.rpc("mark_purchase_bought", { _id: i.id, _qty: q });
      if (error) { toast.error("No se pudo marcar"); return; }
    }
    toast.success(i.pool_id ? `${i.name}: existencias recargadas` : `${i.name} comprado`);
    qc.invalidateQueries();
  }
  async function setQtyOf(i: PurchaseItem, q: number) {
    await supabase.from("purchase_items").update({ qty: q, auto: false }).eq("id", i.id);
    qc.invalidateQueries({ queryKey: ["purchase-items", barId] });
  }
  async function del(i: PurchaseItem) {
    await supabase.from("purchase_items").delete().eq("id", i.id);
    qc.invalidateQueries({ queryKey: ["purchase-items", barId] });
  }
  function share() {
    window.open(`https://wa.me/?text=${encodeURIComponent("Lista de la compra\n\n" + listText(pending))}`, "_blank");
  }
  function print() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="font:16px sans-serif;white-space:pre-wrap">Lista de la compra\n\n${listText(pending).replace(/\*/g, "")}</pre>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Añadir a mano (p. ej. servilletas)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Input type="number" placeholder="Cant." className="w-20" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button onClick={add} className="rounded-md bg-primary px-3 text-primary-foreground" aria-label="Añadir"><Plus className="h-4 w-4" /></button>
      </div>
      {pending.length > 0 && (
        <div className="flex gap-2">
          <button onClick={share} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-semibold"><Share2 className="h-4 w-4" /> WhatsApp</button>
          <button onClick={print} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-semibold"><Printer className="h-4 w-4" /> Imprimir</button>
        </div>
      )}
      {pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No falta nada. Lo que baje del mínimo aparecerá aquí solo.</p>}
      {[...bySupplier].map(([s, list]) => (
        <section key={s} className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s}</h3>
          {list.map((i) => <Row key={i.id} i={i} onBought={markBought} onQty={setQtyOf} onDel={del} />)}
        </section>
      ))}
      {bought.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comprado (últimos 7 días)</h3>
          {bought.slice(0, 15).map((i) => (
            <p key={i.id} className="text-sm text-muted-foreground line-through">{i.qty} {i.unit_label} {i.name}</p>
          ))}
        </section>
      )}
    </div>
  );
}

function Row({ i, onBought, onQty, onDel }: {
  i: PurchaseItem;
  onBought: (i: PurchaseItem, q: number, price?: number) => void;
  onQty: (i: PurchaseItem, q: number) => void;
  onDel: (i: PurchaseItem) => void;
}) {
  const [q, setQ] = useState(String(i.qty));
  const [price, setPrice] = useState("");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{i.name}</p>
        <p className="text-xs text-muted-foreground">{i.pool_id ? "Desde existencias · recarga al comprar" : "Añadido a mano"}</p>
      </div>
      <Input type="number" inputMode="decimal" className="w-16" value={q} onChange={(e) => setQ(e.target.value)}
        onBlur={() => Number(q) > 0 && Number(q) !== i.qty && onQty(i, Number(q))} aria-label="Cantidad" />
      <span className="text-xs text-muted-foreground">{i.unit_label}</span>
      {i.pool_id && (
        <Input type="number" inputMode="decimal" className="w-20" placeholder="€ total" value={price}
          onChange={(e) => setPrice(e.target.value)} aria-label="Precio total" />
      )}
      <button onClick={() => onBought(i, Number(q) || i.qty, Number(price) || 0)} className="rounded-md bg-primary p-2 text-primary-foreground" aria-label="Comprado"><Check className="h-4 w-4" /></button>
      <button onClick={() => onDel(i)} className="p-1 text-muted-foreground" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
