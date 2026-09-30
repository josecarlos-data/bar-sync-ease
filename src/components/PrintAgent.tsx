import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { kitchenTicketHtml, printHtml } from "@/lib/ticket";
import type { BarSettings, Destination } from "@/lib/types";

const KEY = "comandas:this-device-prints";

type Row = {
  id: string;
  created_at: string;
  created_by_role: string;
  table_sessions: { nickname: string | null; tables: { number: number } | null } | null;
  order_items: { name_snapshot: string; qty: number; note: string | null; status: string; destination: Destination; deleted_at: string | null }[];
  order_instructions: { instruction_text: string }[];
};

/** Switch "Este dispositivo imprime" + automatic kitchen ticket printing. */
export function PrintAgent({ barId, settings, destination }: { barId: string; settings: BarSettings; destination: Destination }) {
  const [on, setOn] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => setOn(localStorage.getItem(KEY) === "1"), []);
  const busy = useRef(new Set<string>());

  const scopes: Destination[] =
    settings.printer_scope === "both" ? ["kitchen", "bar"] : [settings.printer_scope ?? "kitchen"];
  const active = settings.printer_enabled && on && (!settings.split_bar_kitchen ? true : scopes.includes(destination));

  const { data: orders = [] } = useQuery({
    queryKey: ["print-queue", barId],
    enabled: !!active,
    refetchInterval: 8000,
    queryFn: async () => {
      const since = new Date(Date.now() - 3 * 3600_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select(
          "id, created_at, created_by_role, table_sessions!inner(status, nickname, tables(number)), order_items(name_snapshot, qty, note, status, destination, deleted_at), order_instructions(instruction_text)",
        )
        .eq("bar_id", barId)
        .is("printed_at", null)
        .eq("table_sessions.status", "open")
        .gte("created_at", since)
        .order("created_at");
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!active) return;
    for (const o of orders) {
      const lines = o.order_items.filter((l) => !l.deleted_at && scopes.includes(l.destination));
      if (!lines.length || busy.current.has(o.id)) continue;
      if (settings.printer_trigger === "ready" && !lines.every((l) => l.status === "ready" || l.status === "served")) continue;
      busy.current.add(o.id);
      void (async () => {
        const { data: claimed } = await supabase.rpc("claim_print", { _order_id: o.id });
        if (!claimed) return;
        printHtml(
          kitchenTicketHtml({
            tableNumber: o.table_sessions?.tables?.number ?? "?",
            nickname: o.table_sessions?.nickname ?? null,
            createdAt: o.created_at,
            label: settings.printer_trigger === "ready" ? "PREPARADA" : "Comanda",
            lines: lines.map((l) => ({ qty: l.qty, name: l.name_snapshot, note: l.note })),
            instructions: o.order_instructions.map((i) => i.instruction_text),
          }),
          settings.printer_width ?? 80,
        );
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, active]);

  if (!settings.printer_enabled) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <label className="flex items-center gap-3">
        <Printer className="h-4 w-4" />
        <span className="flex-1 font-semibold">Este dispositivo imprime</span>
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v);
            localStorage.setItem(KEY, v ? "1" : "0");
          }}
        />
      </label>
      {on && (
        <button className="mt-1 text-xs text-muted-foreground underline" onClick={() => setHelp(!help)}>
          ¿Cómo imprimir sin que pregunte?
        </button>
      )}
      {help && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Conecta la impresora de tickets al tablet/PC y ponla como impresora predeterminada.</li>
          <li>Abre Chrome con la opción <code>--kiosk-printing</code> (en un acceso directo de Windows: añade el texto al final del destino).</li>
          <li>Entra en esta pantalla y deja activado este interruptor. Los tickets saldrán solos.</li>
          <li>Sin ese paso, aparecerá la ventana de imprimir: pulsa Imprimir.</li>
        </ol>
      )}
    </div>
  );
}

export function reprintOrder(
  o: { tableNumber: number | string; nickname: string | null; createdAt: string; lines: { qty: number; name: string; note: string | null }[]; instructions: string[] },
  width: number,
) {
  printHtml(kitchenTicketHtml({ ...o, label: "REIMPRESIÓN" }), width);
}
