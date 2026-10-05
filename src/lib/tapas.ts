import type { BarSettings, Item } from "@/lib/types";

export type TapaMode = "off" | "house" | "choice";
export type SessionTapaLine = {
  item_id: string | null;
  qty: number;
  tapa_kind?: string | null;
  tapa_round?: number | null;
  deleted_at?: string | null;
};
export type CartIn = { itemId: string; qty: number; note: string };
export type PricedLine = {
  item: Item;
  qty: number;
  note: string;
  price: number;
  tapa_kind: "included" | null;
};

export function tapaMode(s?: Partial<BarSettings> | null): TapaMode {
  const m = s?.tapa_mode;
  return m === "house" || m === "choice" ? m : "off";
}

const givesTapa = (it?: Item) => !!it && it.is_drink && it.includes_tapa !== false;

function countDrinks(lines: { item_id: string | null; qty: number }[], items: Item[]) {
  return lines.reduce((s, l) => s + (givesTapa(items.find((i) => i.id === l.item_id)) ? l.qty : 0), 0);
}

const live = (l: SessionTapaLine[]) => l.filter((x) => !x.deleted_at);

/** Bebidas del carrito que dan derecho a tapa. */
export function cartDrinks(cart: CartIn[], items: Item[]) {
  return countDrinks(cart.map((c) => ({ item_id: c.itemId, qty: c.qty })), items);
}

/** Modo Almería: tapas que aún puede elegir la mesa (sesión + carrito). */
export function choiceAllowance(cart: CartIn[], items: Item[], session: SessionTapaLine[]) {
  const s = live(session);
  const drinks = countDrinks(s, items) + cartDrinks(cart, items);
  const used = s.filter((l) => l.tapa_kind === "included").reduce((a, l) => a + l.qty, 0);
  return { drinks, used, remaining: Math.max(0, drinks - used) };
}

/** Precio por línea según el modo. En Almería, divide líneas si solo parte entra en la tapa incluida. */
export function priceCart(
  settings: Partial<BarSettings> | null | undefined,
  cart: CartIn[],
  items: Item[],
  session: SessionTapaLine[],
): PricedLine[] {
  const out: PricedLine[] = [];
  let remaining = tapaMode(settings) === "choice" ? choiceAllowance(cart, items, session).remaining : 0;
  for (const c of cart) {
    const item = items.find((i) => i.id === c.itemId);
    if (!item) continue;
    if (remaining > 0 && item.is_tapa) {
      const inc = Math.min(remaining, c.qty);
      remaining -= inc;
      out.push({ item, qty: inc, note: c.note, price: Number(item.tapa_supplement ?? 0), tapa_kind: "included" });
      if (c.qty - inc > 0) out.push({ item, qty: c.qty - inc, note: c.note, price: Number(item.price), tapa_kind: null });
    } else {
      out.push({ item, qty: c.qty, note: c.note, price: Number(item.price), tapa_kind: null });
    }
  }
  return out;
}

export function pricedTotal(lines: PricedLine[]) {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}

/** Modo Granada: cuántas tapas de cada ronda lleva ya la mesa. */
export function roundCounts(session: SessionTapaLine[]) {
  const c: Record<number, number> = {};
  for (const l of live(session)) {
    if (l.tapa_round) c[l.tapa_round] = (c[l.tapa_round] ?? 0) + l.qty;
  }
  return c;
}

/**
 * Reparte n tapas en rondas: si la última ronda quedó a medias, se completa primero
 * (los que aún no la tienen); el resto pasa a la siguiente. forceNew empieza ronda nueva.
 */
export function proposeRounds(n: number, session: SessionTapaLine[], forceNew = false) {
  const c = roundCounts(session);
  const last = Math.max(0, ...Object.keys(c).map(Number));
  const out: { round: number; qty: number }[] = [];
  let left = n;
  if (!forceNew && last >= 2 && (c[last] ?? 0) < (c[last - 1] ?? 0)) {
    const fill = Math.min(left, (c[last - 1] ?? 0) - (c[last] ?? 0));
    if (fill > 0) out.push({ round: last, qty: fill });
    left -= fill;
  }
  if (left > 0) out.push({ round: last + 1, qty: left });
  return out;
}

export function roundName(settings: Partial<BarSettings> | null | undefined, r: number) {
  const list = Array.isArray(settings?.tapa_rounds) ? (settings!.tapa_rounds as unknown[]).map(String).filter(Boolean) : [];
  if (!list.length) return "";
  const idx = settings?.tapa_rounds_after === "repeat" ? Math.min(r - 1, list.length - 1) : (r - 1) % list.length;
  return list[idx];
}

export function roundLabel(settings: Partial<BarSettings> | null | undefined, r: number) {
  const n = roundName(settings, r);
  return `${r}.ª tapa${n ? ` · ${n}` : ""}`;
}

/** Líneas de cocina para el modo Granada. Las que superan las bebidas con tapa se cobran como extra. */
export function houseTapaLines(
  settings: Partial<BarSettings> | null | undefined,
  rounds: { round: number; qty: number }[],
  includedDrinks: number,
) {
  let free = includedDrinks;
  const extraPrice = Number(settings?.tapa_extra_price ?? 0);
  const lines: { name: string; price: number; qty: number; tapa_kind: "round" | "extra"; tapa_round: number }[] = [];
  for (const r of rounds) {
    const inc = Math.min(free, r.qty);
    free -= inc;
    if (inc > 0) lines.push({ name: roundLabel(settings, r.round), price: 0, qty: inc, tapa_kind: "round", tapa_round: r.round });
    if (r.qty - inc > 0)
      lines.push({ name: `${roundLabel(settings, r.round)} (extra)`, price: extraPrice, qty: r.qty - inc, tapa_kind: "extra", tapa_round: r.round });
  }
  return lines;
}
