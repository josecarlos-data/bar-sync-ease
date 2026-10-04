// Shared live computation of a bill split (client + waiter views).
export type SplitCalcLine = { id: string; name: string; price: number; qty: number };
export type SplitCalcPart = {
  id: string;
  label: string;
  position: number;
  amount: number;
  status: "pending" | "paid" | "with_waiter";
  bill_split_assignments?: { id: string; order_item_id: string; qty: number }[];
};

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export function computeSplit(
  mode: "equal" | "groups",
  parts: SplitCalcPart[],
  lines: SplitCalcLine[],
) {
  const total = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const amounts = new Map<string, number>();

  if (mode === "equal") {
    const paid = parts.filter((p) => p.status === "paid");
    const open = parts.filter((p) => p.status !== "paid");
    const paidSum = round2(paid.reduce((s, p) => s + Number(p.amount), 0));
    const rest = round2(Math.max(0, total - paidSum));
    paid.forEach((p) => amounts.set(p.id, Number(p.amount)));
    if (open.length) {
      const base = Math.floor((rest * 100) / open.length) / 100;
      open.forEach((p, i) =>
        amounts.set(p.id, i === open.length - 1 ? round2(rest - base * (open.length - 1)) : base),
      );
    }
    const unassigned = open.length ? 0 : rest;
    return { total, amounts, unassigned, unassignedLines: [] as (SplitCalcLine & { left: number })[], paidSum };
  }

  const assigned = new Map<string, number>();
  for (const p of parts) {
    let sum = 0;
    for (const a of p.bill_split_assignments ?? []) {
      assigned.set(a.order_item_id, (assigned.get(a.order_item_id) ?? 0) + Number(a.qty));
      const line = lines.find((l) => l.id === a.order_item_id);
      if (line) sum += line.price * Number(a.qty);
    }
    amounts.set(p.id, round2(sum));
  }
  const unassignedLines = lines
    .map((l) => ({ ...l, left: round2(l.qty - (assigned.get(l.id) ?? 0)) }))
    .filter((l) => l.left > 0.001);
  const unassigned = round2(unassignedLines.reduce((s, l) => s + l.price * l.left, 0));
  const paidSum = round2(
    parts.filter((p) => p.status === "paid").reduce((s, p) => s + (amounts.get(p.id) ?? 0), 0),
  );
  return { total, amounts, unassigned, unassignedLines, paidSum };
}
