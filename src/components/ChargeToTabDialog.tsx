import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR } from "@/lib/allergens";

type TabOpt = { id: string; name: string; phone: string; last: string; total: number };

/** «Ponlo a mi cuenta»: carga una mesa (o una parte de su cuenta) en el fiado de alguien. */
export function ChargeToTabDialog({
  barId, sessionId, label, amount, partId, partLabel, onClose, onDone,
}: {
  barId: string;
  sessionId: string;
  label: string;
  amount: number;
  partId?: string;
  partLabel?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ id?: string; name: string } | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tabs = [] } = useQuery({
    queryKey: ["charge-tabs", barId],
    queryFn: async (): Promise<TabOpt[]> => {
      const { data: t } = await supabase.from("customer_tabs").select("id,name,phone,opened_at").eq("bar_id", barId).eq("status", "open");
      const ids = (t ?? []).map((x) => x.id);
      const { data: l } = ids.length
        ? await supabase.from("customer_tab_lines").select("tab_id,created_at,price_snapshot,qty").in("tab_id", ids)
        : { data: [] };
      return (t ?? []).map((x) => {
        const mine = (l ?? []).filter((r) => r.tab_id === x.id);
        const last = mine.reduce((m, r) => (r.created_at > m ? r.created_at : m), x.opened_at);
        return { id: x.id, name: x.name, phone: x.phone, last, total: mine.reduce((s, r) => s + Number(r.price_snapshot) * r.qty, 0) };
      }).sort((a, b) => b.last.localeCompare(a.last));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tabs.filter((t) => t.name.toLowerCase().includes(s) || t.phone.includes(s)) : tabs;
  }, [q, tabs]);

  async function confirm() {
    if (!pick) return;
    setBusy(true);
    let tabId = pick.id;
    if (!tabId) {
      const { data, error } = await supabase.from("customer_tabs")
        .insert({ bar_id: barId, name: pick.name.trim(), phone: newPhone.trim() })
        .select("id").single();
      if (error || !data) { setBusy(false); toast.error("No se pudo crear la cuenta"); return; }
      tabId = data.id;
    }
    const { error } = await supabase.rpc("charge_session_to_tab",
      partId ? { _session: sessionId, _tab: tabId, _split_part: partId, _amount: amount } : { _session: sessionId, _tab: tabId });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("unassigned") ? "Queda consumo sin asignar: repartidlo antes"
        : error.message.includes("empty") ? "No hay nada que cargar" : "No se pudo cargar a la cuenta");
      return;
    }
    toast.success(`${formatEUR(amount)} cargados a la cuenta de ${pick.name}`);
    qc.invalidateQueries();
    onDone?.();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>A la cuenta de…</DialogTitle>
        </DialogHeader>
        {!pick ? (
          <>
            <p className="text-sm text-muted-foreground">
              {label}{partLabel ? ` · ${partLabel}` : ""} · <b className="text-foreground">{formatEUR(amount)}</b>
            </p>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar o escribir nombre" className="pl-8" />
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setPick({ id: t.id, name: t.name })}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-3 text-left hover:bg-secondary">
                    <span className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4" />{t.name}</span>
                    <span className="text-xs text-muted-foreground">debe {formatEUR(t.total)}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && !q.trim() && (
                <li className="py-4 text-center text-sm text-muted-foreground">No hay cuentas abiertas todavía.</li>
              )}
            </ul>
            {q.trim() && !tabs.some((t) => t.name.toLowerCase() === q.trim().toLowerCase()) && (
              <Button variant="outline" onClick={() => setPick({ name: q.trim() })}>
                <Plus className="mr-1 h-4 w-4" /> Nueva cuenta: «{q.trim()}»
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-base">
              Pasar <b>{formatEUR(amount)}</b> de {label}{partLabel ? ` (${partLabel})` : ""} a la cuenta de <b>{pick.name}</b>
              {!pick.id && " (cuenta nueva)"}.
            </p>
            {!partId && <p className="text-sm text-muted-foreground">La mesa se cerrará y quedará libre.</p>}
            {!pick.id && (
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Teléfono (opcional)" inputMode="tel" />
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPick(null)} disabled={busy}>Atrás</Button>
              <Button className="flex-1" onClick={confirm} disabled={busy}>Aceptar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
