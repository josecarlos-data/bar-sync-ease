import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rewriteKitchenInstruction } from "@/lib/kitchen.functions";

export function KitchenInstructionDialog({
  barId,
  sessionId,
  tableNumber,
  userId,
  onClose,
}: {
  barId: string;
  sessionId: string;
  tableNumber: number;
  userId: string;
  onClose: () => void;
}) {
  const rewrite = useServerFn(rewriteKitchenInstruction);
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["instruction-orders", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, created_at, order_items(qty, name_snapshot, deleted_at)")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const selected = orderId ?? orders[0]?.id ?? null;

  async function convert() {
    if (!selected || text.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await rewrite({ data: { orderId: selected, text } });
      if (r.ok) setResult(r.text);
      else toast.error(r.error);
    } catch {
      toast.error("No se pudo convertir la indicación");
    } finally {
      setBusy(false);
    }
  }

  async function send(finalText: string) {
    if (!selected || !finalText.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("order_instructions").insert({
      bar_id: barId,
      order_id: selected,
      original_text: text.trim(),
      instruction_text: finalText.trim(),
      created_by: userId,
    });
    setBusy(false);
    if (error) { toast.error("No se pudo enviar la indicación"); return; }
    toast.success("Indicación enviada a cocina");
    queryClient.invalidateQueries();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Indicación a cocina · Mesa {tableNumber}</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta mesa aún no tiene comandas.</p>
        ) : (
          <>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Comanda</label>
            <select
              value={selected ?? ""}
              onChange={(e) => setOrderId(e.target.value)}
              className="mb-3 mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {new Date(o.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}{" · "}
                  {(o.order_items ?? []).filter((l) => !l.deleted_at).map((l) => `${l.qty}× ${l.name_snapshot}`).join(", ")}
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold uppercase text-muted-foreground">Indicación</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Ej.: el niño es celiaco y la carne poco hecha"
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
            <button
              onClick={convert}
              disabled={busy || text.trim().length < 2}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" /> {busy ? "Procesando…" : "Convertir"}
            </button>

            {result && (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase text-muted-foreground">Para cocina (editable)</label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-warning bg-background p-2 text-sm font-semibold"
                />
              </>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => send(text)}
                disabled={busy || text.trim().length < 2}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Enviar sin convertir
              </button>
              {result && (
                <button
                  onClick={() => send(result)}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50"
                >
                  Enviar a cocina
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
