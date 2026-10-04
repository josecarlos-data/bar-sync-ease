import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/StaffShell";
import { QueueBoard } from "@/components/QueueBoard";
import { TicketPrintAgent } from "@/components/TicketPrintAgent";
import { useBarSettings, useStaff } from "@/hooks/useStaff";

export const Route = createFileRoute("/_authenticated/barra")({
  head: () => ({
    meta: [
      { title: "Barra — Comandas de bar" },
      { name: "description", content: "Cola de bebidas pendientes en tiempo real." },
    ],
  }),
  component: BarPage,
});

function BarPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  return (
    <StaffShell title="Barra">
      {barId && settings && <TicketPrintAgent barId={barId} settings={settings} />}
      <QueueBoard destination="bar" />
    </StaffShell>
  );
}
