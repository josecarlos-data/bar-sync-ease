import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/StaffShell";
import { QueueBoard } from "@/components/QueueBoard";

export const Route = createFileRoute("/_authenticated/barra")({
  head: () => ({
    meta: [
      { title: "Barra — Comandas de bar" },
      { name: "description", content: "Cola de bebidas pendientes en tiempo real." },
    ],
  }),
  component: () => (
    <StaffShell title="Barra">
      <QueueBoard destination="bar" />
    </StaffShell>
  ),
});
