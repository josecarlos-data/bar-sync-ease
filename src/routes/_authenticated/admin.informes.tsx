import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { useStaff } from "@/hooks/useStaff";
import { formatEUR } from "@/lib/allergens";

export const Route = createFileRoute("/_authenticated/admin/informes")({
  component: InformesPage,
});

type RangeKey = "hoy" | "7d" | "30d";
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "hoy", label: "Hoy", days: 1 },
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
];

function rangeDates(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function InformesPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const [range, setRange] = useState<RangeKey>("7d");
  const days = RANGES.find((r) => r.key === range)!.days;
  const { from, to } = useMemo(() => rangeDates(days), [days]);

  const { data: byDay = [] } = useQuery({
    queryKey: ["rep-day", barId, from],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.rpc("sales_report", { _bar_id: barId!, _from: from, _to: to });
      return (data ?? []) as { day: string; tickets: number; total: number }[];
    },
  });
  const { data: byHour = [] } = useQuery({
    queryKey: ["rep-hour", barId, from],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.rpc("sales_by_hour", { _bar_id: barId!, _from: from, _to: to });
      return (data ?? []) as { hour: number; tickets: number; total: number }[];
    },
  });
  const { data: byMethod = [] } = useQuery({
    queryKey: ["rep-method", barId, from],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.rpc("sales_by_method", { _bar_id: barId!, _from: from, _to: to });
      return (data ?? []) as { method: string; parts: number; total: number }[];
    },
  });
  const { data: top = [] } = useQuery({
    queryKey: ["rep-top", barId, from],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.rpc("top_items", { _bar_id: barId!, _from: from, _to: to, _limit: 15 });
      return (data ?? []) as { name: string; units: number; revenue: number }[];
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const { data: close } = useQuery({
    queryKey: ["rep-close", barId, today],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase.rpc("daily_close", { _bar_id: barId!, _day: today });
      return data as {
        day: string; tickets: number; invoiced: number; tabs_closed: number;
        by_method: { method: string; total: number; parts: number }[];
      } | null;
    },
  });

  const total = byDay.reduce((a, d) => a + Number(d.total), 0);
  const tickets = byDay.reduce((a, d) => a + Number(d.tickets), 0);
  const avg = tickets > 0 ? total / tickets : 0;
  const maxHour = Math.max(1, ...byHour.map((h) => Number(h.total)));

  function exportCsv() {
    const rows = [
      ["Día", "Tickets", "Total"],
      ...byDay.map((d) => [d.day, String(d.tickets), Number(d.total).toFixed(2).replace(".", ",")]),
      [],
      ["Forma de pago", "Cobros", "Total"],
      ...byMethod.map((m) => [m.method, String(m.parts), Number(m.total).toFixed(2).replace(".", ",")]),
      [],
      ["Producto", "Unidades", "Ingresos"],
      ...top.map((t) => [t.name, String(t.units), Number(t.revenue).toFixed(2).replace(".", ",")]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `informe-${from.slice(0, 10)}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <StaffShell title="Informes">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-border p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!byDay.length}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="font-display text-lg font-bold tabular-nums">{formatEUR(total)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Tickets</p>
          <p className="font-display text-lg font-bold tabular-nums">{tickets}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Ticket medio</p>
          <p className="font-display text-lg font-bold tabular-nums">{formatEUR(avg)}</p>
        </div>
      </div>

      {close && (
        <section className="mb-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Cierre de caja de hoy</h2>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{close.tickets} tickets · {close.tabs_closed} cuentas de fiado cerradas</span>
            <span className="font-bold tabular-nums">{formatEUR(Number(close.invoiced))}</span>
          </div>
          <ul className="divide-y divide-border text-sm">
            {close.by_method.map((m) => (
              <li key={m.method} className="flex justify-between py-1.5">
                <span className="capitalize">{m.method} <span className="text-muted-foreground">({m.parts})</span></span>
                <span className="tabular-nums">{formatEUR(Number(m.total))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Ventas por día</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {[...byDay].reverse().map((d) => (
              <li key={d.day} className="flex justify-between py-1.5">
                <span>{new Date(d.day + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="text-muted-foreground">{d.tickets} tickets</span>
                <span className="font-semibold tabular-nums">{formatEUR(Number(d.total))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Ventas por hora</h2>
        {byHour.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="flex h-28 items-end gap-1">
            {byHour.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(4, (Number(h.total) / maxHour) * 88)}px` }}
                  title={`${h.hour}h — ${formatEUR(Number(h.total))}`}
                />
                <span className="text-[10px] text-muted-foreground">{h.hour}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Por forma de pago</h2>
        {byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobros en el periodo.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {byMethod.map((m) => (
              <li key={m.method} className="flex justify-between py-1.5">
                <span className="capitalize">{m.method} <span className="text-muted-foreground">({m.parts})</span></span>
                <span className="font-semibold tabular-nums">{formatEUR(Number(m.total))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Productos más vendidos</h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {top.map((t, i) => (
              <li key={t.name} className="flex items-center gap-2 py-1.5">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                <span className="flex-1">{t.name}</span>
                <span className="text-muted-foreground">{t.units} uds</span>
                <span className="font-semibold tabular-nums">{formatEUR(Number(t.revenue))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StaffShell>
  );
}
