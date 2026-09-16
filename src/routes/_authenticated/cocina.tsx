import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/StaffShell";
import { QueueBoard } from "@/components/QueueBoard";

export const Route = createFileRoute("/_authenticated/cocina")({
  head: () => ({
    meta: [
      { title: "Cocina — Comandas de bar" },
      { name: "description", content: "Cola de platos pendientes en tiempo real." },
    ],
  }),
  component: () => (
    <StaffShell title="Cocina">
      <QueueBoard destination="kitchen" />
    </StaffShell>
  ),
});
