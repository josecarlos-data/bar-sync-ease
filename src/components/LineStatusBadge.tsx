import type { LineStatus } from "@/lib/types";

export const LINE_STATUS: Record<LineStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
  preparing: { label: "En preparación", className: "bg-warning text-warning-foreground" },
  ready: { label: "Preparada", className: "bg-success text-success-foreground" },
  served: { label: "Servida", className: "bg-secondary text-secondary-foreground" },
};

export function LineStatusBadge({ status }: { status: LineStatus }) {
  const s = LINE_STATUS[status] ?? LINE_STATUS.pending;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.className}`}>
      {s.label}
    </span>
  );
}

/** Minutes elapsed → colour class (amber ≥10, red ≥20). */
export function ageClass(createdAt: string, now: number) {
  const min = (now - new Date(createdAt).getTime()) / 60000;
  if (min >= 20) return "text-destructive font-bold";
  if (min >= 10) return "text-warning-foreground bg-warning/30 rounded px-1 font-bold";
  return "text-muted-foreground";
}

export function ageLabel(createdAt: string, now: number) {
  const min = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
