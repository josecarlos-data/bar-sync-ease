/** Las cuentas de barra usan mesas internas numeradas desde 901. */
export const COUNTER_BASE = 900;
export function tableLabel(n: number | null | undefined | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (num == null || Number.isNaN(num)) return "Mesa ?";
  return num > COUNTER_BASE ? `Barra ${num - COUNTER_BASE}` : `Mesa ${num}`;
}
