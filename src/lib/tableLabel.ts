/** Las cuentas de barra usan mesas internas numeradas desde 901. */
export const COUNTER_BASE = 900;
export function tableLabel(n: number | null | undefined | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (num == null || Number.isNaN(num)) return "Mesa ?";
  return num > COUNTER_BASE ? `Barra ${num - COUNTER_BASE}` : `Mesa ${num}`;
}

/** Apodo solo si aporta algo: vacío o igual al nombre de la mesa → null. */
export function displayNickname(nickname: string | null | undefined, n?: number | string | null): string | null {
  const v = (nickname ?? "").trim();
  if (!v) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (n != null && norm(v) === norm(tableLabel(n))) return null;
  if (/^(mesa|barra)\s*\d+$/i.test(v) && n == null) return null;
  return v;
}
