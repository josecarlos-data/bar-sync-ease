import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Minus, Plus, Split, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR } from "@/lib/allergens";
import { Input } from "@/components/ui/input";

export type SplitLine = { id: string; name: string; price: number; qty: number };

type PartRow = {
  id: string;
  label: string;
  position: number;
  amount: number;
  status: "pending" | "paid" | "with_waiter";
  bill_split_assignments: { id: string; order_item_id: string; qty: number }[];
};

type SplitRow = {
  id: string;
  mode: "equal" | "groups";
  people: number;
  status: "open" | "requested" | "settled";
  bill_split_parts: PartRow[];
};

const GROUP_LABELS = "ABCDEFGH".split("");
const WAITER_LABEL = "Pendiente con camarero";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function SplitBill({
  sessionId,
  barId,
  lines,
  total,
  paymentsEnabled,
  onRequestWaiter,
}: {
  sessionId: string;
  barId: string;
  lines: SplitLine[];
  total: number;
  paymentsEnabled: boolean;
  onRequestWaiter: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const [people, setPeople] = useState(2);
  const [groups, setGroups] = useState(2);
  const [busy, setBusy] = useState(false);

  const { data: split } = useQuery({
    queryKey: ["bill-split", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bill_splits")
        .select(
          "id, mode, people, status, bill_split_parts(id, label, position, amount, status, bill_split_assignments(id, order_item_id, qty))",
        )
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!data) return null;
      const row = data as unknown as SplitRow;
      row.bill_split_parts.sort((a, b) => a.position - b.position);
      return row;
    },
  });

  const parts = split?.bill_split_parts ?? [];

  const assignedByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const part of parts) {
      for (const a of part.bill_split_assignments) {
        map.set(a.order_item_id, (map.get(a.order_item_id) ?? 0) + Number(a.qty));
      }
    }
    return map;
  }, [parts]);

  const remainingLines = lines
    .map((l) => ({ ...l, left: round2(l.qty - (assignedByLine.get(l.id) ?? 0)) }))
    .filter((l) => l.left > 0.001);

  const remainingAmount = round2(remainingLines.reduce((s, l) => s + l.price * l.left, 0));

  function partAmount(part: PartRow) {
    if (split?.mode === "equal") return Number(part.amount);
    return round2(
      part.bill_split_assignments.reduce((sum, a) => {
        const line = lines.find((l) => l.id === a.order_item_id);
        return sum + (line ? line.price * Number(a.qty) : 0);
      }, 0),
    );
  }

  async function reset() {
    if (split) await supabase.from("bill_splits").delete().eq("id", split.id);
  }

  async function startEqual() {
    if (total <= 0) { toast.info("Todavía no hay nada que dividir"); return; }
    setBusy(true);
    await reset();
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("bill_splits")
      .insert({
        bar_id: barId,
        session_id: sessionId,
        mode: "equal",
        people,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) { setBusy(false); toast.error("No se pudo crear la división"); return; }

    const base = Math.floor((total * 100) / people) / 100;
    const rows = Array.from({ length: people }, (_, i) => ({
      bar_id: barId,
      split_id: created.id,
      label: `Persona ${i + 1}`,
      position: i,
      amount: i === people - 1 ? round2(total - base * (people - 1)) : base,
    }));
    await supabase.from("bill_split_parts").insert(rows);
    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function startGroups() {
    if (total <= 0) { toast.info("Todavía no hay nada que dividir"); return; }
    setBusy(true);
    await reset();
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("bill_splits")
      .insert({
        bar_id: barId,
        session_id: sessionId,
        mode: "groups",
        people: groups,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) { setBusy(false); toast.error("No se pudo crear la división"); return; }
    await supabase.from("bill_split_parts").insert(
      Array.from({ length: groups }, (_, i) => ({
        bar_id: barId,
        split_id: created.id,
        label: `Grupo ${GROUP_LABELS[i]}`,
        position: i,
      })),
    );
    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function changeAssignment(part: PartRow, lineId: string, delta: number) {
    const existing = part.bill_split_assignments.find((a) => a.order_item_id === lineId);
    const line = lines.find((l) => l.id === lineId)!;
    const left = round2(line.qty - (assignedByLine.get(lineId) ?? 0));
    const current = existing ? Number(existing.qty) : 0;
    const next = round2(current + delta);
    if (delta > 0 && left < 1) return;
    if (next <= 0) {
      if (existing) await supabase.from("bill_split_assignments").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("bill_split_assignments").update({ qty: next }).eq("id", existing.id);
    } else {
      await supabase
        .from("bill_split_assignments")
        .insert({ bar_id: barId, part_id: part.id, order_item_id: lineId, qty: next });
    }
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function shareRemainder() {
    if (!split || remainingLines.length === 0) return;
    setBusy(true);
    const groupParts = parts.filter((p) => p.status !== "with_waiter");
    for (const line of remainingLines) {
      const share = round2(line.left / groupParts.length);
      for (const part of groupParts) {
        const existing = part.bill_split_assignments.find((a) => a.order_item_id === line.id);
        const qty = round2((existing ? Number(existing.qty) : 0) + share);
        if (existing) {
          await supabase.from("bill_split_assignments").update({ qty }).eq("id", existing.id);
        } else {
          await supabase
            .from("bill_split_assignments")
            .insert({ bar_id: barId, part_id: part.id, order_item_id: line.id, qty });
        }
      }
    }
    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function leaveWithWaiter() {
    if (!split || remainingLines.length === 0) return;
    setBusy(true);
    let waiterPart = parts.find((p) => p.status === "with_waiter");
    if (!waiterPart) {
      const { data: created } = await supabase
        .from("bill_split_parts")
        .insert({
          bar_id: barId,
          split_id: split.id,
          label: WAITER_LABEL,
          position: 99,
          status: "with_waiter",
        })
        .select("id, label, position, amount, status")
        .single();
      if (!created) { setBusy(false); toast.error("No se pudo guardar"); return; }
      waiterPart = { ...(created as unknown as PartRow), bill_split_assignments: [] };
    }
    for (const line of remainingLines) {
      const existing = waiterPart.bill_split_assignments.find((a) => a.order_item_id === line.id);
      const qty = round2((existing ? Number(existing.qty) : 0) + line.left);
      if (existing) {
        await supabase.from("bill_split_assignments").update({ qty }).eq("id", existing.id);
      } else {
        await supabase
          .from("bill_split_assignments")
          .insert({ bar_id: barId, part_id: waiterPart.id, order_item_id: line.id, qty });
      }
    }
    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function requestBill() {
    if (!split) return;
    if (split.mode === "groups" && remainingAmount > 0.009) {
      toast.error("Asigna todo lo que queda antes de pedir la cuenta");
      return;
    }
    setBusy(true);
    if (split.mode === "groups") {
      for (const part of parts) {
        await supabase
          .from("bill_split_parts")
          .update({ amount: partAmount(part) })
          .eq("id", part.id);
      }
    }
    await supabase.from("bill_splits").update({ status: "requested" }).eq("id", split.id);
    await onRequestWaiter();
    setBusy(false);
    toast.success("El camarero ya tiene vuestra división");
    queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
  }

  async function payPart(part: PartRow) {
    toast.info("El pago online se activará cuando el bar conecte la pasarela.");
    void part;
  }

  if (!split) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Split className="h-4 w-4" /> Dividir la cuenta
        </p>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={2}
            max={20}
            value={people}
            onChange={(e) => setPeople(Math.max(2, Number(e.target.value) || 2))}
            className="w-20"
            aria-label="Número de personas"
          />
          <button
            disabled={busy}
            onClick={startEqual}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            A partes iguales
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Split className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={2}
            max={8}
            value={groups}
            onChange={(e) => setGroups(Math.min(8, Math.max(2, Number(e.target.value) || 2)))}
            className="w-20"
            aria-label="Número de grupos"
          />
          <button
            disabled={busy}
            onClick={startGroups}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold"
          >
            Por consumo (grupos)
          </button>
        </div>
      </div>
    );
  }

  const requested = split.status !== "open";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          {split.mode === "equal"
            ? `A partes iguales entre ${split.people}`
            : `Por consumo · ${parts.filter((p) => p.status !== "with_waiter").length} grupos`}
        </p>
        {!requested && (
          <button
            onClick={async () => {
              await reset();
              queryClient.invalidateQueries({ queryKey: ["bill-split", sessionId] });
            }}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            Empezar de nuevo
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {parts.map((part) => (
          <li key={part.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{part.label}</span>
              <span className="tabular font-display font-extrabold">
                {formatEUR(partAmount(part))}
              </span>
            </div>

            {split.mode === "groups" && part.status !== "with_waiter" && !requested && (
              <ul className="mt-2 space-y-1">
                {lines.map((line) => {
                  const assigned =
                    Number(
                      part.bill_split_assignments.find((a) => a.order_item_id === line.id)?.qty ?? 0,
                    ) || 0;
                  const left = round2(line.qty - (assignedByLine.get(line.id) ?? 0));
                  if (assigned === 0 && left <= 0) return null;
                  return (
                    <li key={line.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{line.name}</span>
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => changeAssignment(part, line.id, -1)}
                          disabled={assigned <= 0}
                          aria-label={`Quitar ${line.name} de ${part.label}`}
                          className="rounded-md border border-border p-1.5 disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="tabular w-8 text-center font-semibold">
                          {assigned % 1 === 0 ? assigned : assigned.toFixed(2)}
                        </span>
                        <button
                          onClick={() => changeAssignment(part, line.id, 1)}
                          disabled={left < 1}
                          aria-label={`Añadir ${line.name} a ${part.label}`}
                          className="rounded-md bg-secondary p-1.5 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {part.status === "with_waiter" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Lo resolvéis directamente con el camarero.
              </p>
            )}
            {part.status === "paid" && (
              <p className="mt-1 text-xs font-bold text-success">Pagada</p>
            )}

            {requested && paymentsEnabled && part.status === "pending" && (
              <button
                onClick={() => payPart(part)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <CreditCard className="h-4 w-4" /> Pagar esta parte
              </button>
            )}
          </li>
        ))}
      </ul>

      {split.mode === "groups" && !requested && remainingAmount > 0.009 && (
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-sm font-semibold">
            Sin asignar: {formatEUR(remainingAmount)}
          </p>
          <p className="text-xs text-muted-foreground">
            No se puede pedir la cuenta hasta repartir lo que queda.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy}
              onClick={shareRemainder}
              className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold"
            >
              Repartir entre los grupos
            </button>
            <button
              disabled={busy}
              onClick={leaveWithWaiter}
              className="flex-1 rounded-lg border border-border bg-card py-2 text-xs font-semibold"
            >
              Dejar con el camarero
            </button>
          </div>
        </div>
      )}

      {!requested && (
        <button
          disabled={busy}
          onClick={requestBill}
          className="w-full rounded-lg bg-foreground py-3 font-semibold text-background disabled:opacity-60"
        >
          Solicitar cuenta dividida
        </button>
      )}
      {requested && (
        <p className="text-sm text-muted-foreground">
          El camarero ya tiene la división. {paymentsEnabled ? "Cada parte puede pagarse aquí." : "Se cobra en la mesa."}
        </p>
      )}
    </div>
  );
}
