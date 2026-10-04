import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/useRealtime";
import { invoiceHtml, printHtml, provisionalTicketHtml, type InvoiceRow } from "@/lib/ticket";
import type { BarSettings } from "@/lib/types";

const KEY = "comandas:this-device-prints-tickets";

type Job = { id: string; session_id: string; invoice_id: string | null; kind: "provisional" | "final" };

/** Builds and prints the customer ticket for a print job. */
export async function printJob(job: Pick<Job, "session_id" | "invoice_id" | "kind">, barId: string, width: number) {
  if (job.kind === "final" && job.invoice_id) {
    const { data } = await supabase.from("invoices").select("*").eq("id", job.invoice_id).single();
    if (data) printHtml(invoiceHtml(data as unknown as InvoiceRow), width);
    return;
  }
  const [{ data: s }, { data: bar }, { data: st }, { data: lines }] = await Promise.all([
    supabase.from("table_sessions").select("nickname, tables(number)").eq("id", job.session_id).single(),
    supabase.from("bars").select("name").eq("id", barId).single(),
    supabase.from("bar_settings").select("legal_name, tax_id, address, phone, ticket_footer").eq("bar_id", barId).single(),
    supabase
      .from("order_items")
      .select("name_snapshot, price_snapshot, tax_rate_snapshot, qty, orders!inner(session_id)")
      .eq("orders.session_id", job.session_id)
      .is("deleted_at", null),
  ]);
  const sess = s as unknown as { nickname: string | null; tables: { number: number } | null } | null;
  printHtml(
    provisionalTicketHtml({
      bar: {
        name: bar?.name ?? "",
        legal_name: st?.legal_name ?? null,
        tax_id: st?.tax_id ?? null,
        address: st?.address ?? null,
        phone: st?.phone ?? null,
        footer: st?.ticket_footer ?? null,
      },
      tableNumber: sess?.tables?.number ?? 0,
      nickname: sess?.nickname ?? null,
      lines: (lines ?? []).map((l) => ({
        name: l.name_snapshot,
        price: Number(l.price_snapshot),
        taxRate: Number(l.tax_rate_snapshot),
        qty: l.qty,
      })),
    }),
    width,
  );
}

/** Sends a print job to the bar ticket printer (any staff device). */
export async function sendToBarPrinter(barId: string, sessionId: string, userId?: string | null) {
  const { data: inv } = await supabase
    .from("invoices").select("id").eq("session_id", sessionId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("print_jobs").insert({
    bar_id: barId,
    session_id: sessionId,
    invoice_id: inv?.id ?? null,
    kind: inv ? "final" : "provisional",
    created_by: userId ?? null,
  });
  if (error) toast.error("No se pudo enviar a la impresora");
  else toast.success("Enviado a la impresora de la barra");
}

export function PrintToBarButton({ barId, sessionId, userId, settings }: { barId: string; sessionId: string; userId?: string | null; settings?: BarSettings | null }) {
  if (!settings?.ticket_printer_enabled) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => sendToBarPrinter(barId, sessionId, userId)}>
      <Receipt className="mr-1 h-4 w-4" /> Imprimir en barra
    </Button>
  );
}

/** Switch "Este dispositivo imprime tickets" + automatic customer ticket printing. */
export function TicketPrintAgent({ barId, settings }: { barId: string; settings: BarSettings }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(localStorage.getItem(KEY) === "1"), []);
  const busy = useRef(new Set<string>());
  const active = !!settings.ticket_printer_enabled && on;
  useRealtime("ticket-print", ["print_jobs"], active);

  const { data: jobs = [] } = useQuery({
    queryKey: ["print-jobs", barId],
    enabled: active,
    refetchInterval: 8000,
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const { data } = await supabase
        .from("print_jobs")
        .select("id, session_id, invoice_id, kind")
        .eq("bar_id", barId)
        .is("printed_at", null)
        .gte("created_at", since)
        .order("created_at");
      return (data ?? []) as Job[];
    },
  });

  useEffect(() => {
    if (!active) return;
    for (const j of jobs) {
      if (busy.current.has(j.id)) continue;
      busy.current.add(j.id);
      void (async () => {
        const { data: claimed } = await supabase.rpc("claim_print_job", { _id: j.id });
        if (!claimed) return;
        await printJob(j, barId, settings.ticket_printer_width ?? 80);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, active]);

  if (!settings.ticket_printer_enabled) return null;
  return (
    <label className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
      <Printer className="h-4 w-4" />
      <span className="flex-1 font-semibold">Este dispositivo imprime tickets de cliente</span>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          localStorage.setItem(KEY, v ? "1" : "0");
        }}
      />
    </label>
  );
}
