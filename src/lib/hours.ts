/** Horario de apertura por bar: cálculo con la zona horaria del negocio. */
import { dayName, t, type Lang } from "./i18n";


export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const WEEKDAY_TO_KEY: Record<number, DayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export type DayHours = { open: string; close: string };
export type WeekHours = Partial<Record<DayKey, DayHours | null>>;

/** Acepta el jsonb de ajustes y lo deja en forma usable. */
export function parseHours(raw: unknown): WeekHours {
  const out: WeekHours = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of DAY_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (v && typeof v === "object") {
      const open = String((v as Record<string, unknown>)["open"] ?? "");
      const close = String((v as Record<string, unknown>)["close"] ?? "");
      if (/^\d{1,2}:\d{2}$/.test(open) && /^\d{1,2}:\d{2}$/.test(close)) {
        out[key] = { open: to24(open), close: to24(close) };
      }
    } else {
      out[key] = null;
    }
  }
  return out;
}

function to24(v: string) {
  const [h, m] = v.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
}

export function minutesOf(v: string) {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Partes del reloj local del negocio (no del navegador). */
function wallClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const minute = get("minute");
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, weekday, key: WEEKDAY_TO_KEY[weekday] ?? "mon" };
}

function isOpenAt(hours: WeekHours, key: DayKey, minutes: number) {
  const d = hours[key];
  if (!d) return false;
  const open = minutesOf(d.open);
  const close = minutesOf(d.close);
  if (close > open) return minutes >= open && minutes < close;
  // Cruza medianoche: la franja de esta noche empezó en este día.
  return minutes >= open || minutes < close;
}

function spilloverOpen(hours: WeekHours, key: DayKey, minutes: number) {
  const prev = DAY_KEYS[(DAY_KEYS.indexOf(key) + 6) % 7] ?? "mon";
  const d = hours[prev];
  if (!d) return false;
  const open = minutesOf(d.open);
  const close = minutesOf(d.close);
  if (close > open) return false;
  return minutes < close;
}

/** ¿Está el local abierto en este momento? */
export function isOpenNow(hours: WeekHours, timezone: string, date = new Date()) {
  const now = wallClock(date, timezone);
  const minutes = now.hour * 60 + now.minute;
  return isOpenAt(hours, now.key, minutes) || spilloverOpen(hours, now.key, minutes);
}

export type OpenStatus = { open: boolean; text: string };

/** Frase para el cliente: «Abierto hasta las 23:00» o «Cerrado · abre hoy a las 20:00». */
export function openStatus(hours: WeekHours, timezone: string, lang: Lang = "es", date = new Date()): OpenStatus {
  const now = wallClock(date, timezone);
  const minutes = now.hour * 60 + now.minute;

  if (isOpenAt(hours, now.key, minutes)) {
    const d = hours[now.key];
    if (d) {
      const close = minutesOf(d.close);
      const open = minutesOf(d.open);
      const ends = close > open ? close : close + 24 * 60;
      if (ends - minutes <= 60) return { open: true, text: `${t("closingIn", lang)} ${ends - minutes} min` };
      return { open: true, text: `${t("openUntil", lang)} ${d.close}` };
    }
  }

  const next = nextOpening(hours, timezone, date);
  if (!next) return { open: false, text: t("closedNow", lang) };
  const when =
    next.kind === "today" ? t("today", lang) : next.kind === "tomorrow" ? t("tomorrow", lang) : dayName(next.day ?? "mon", lang);
  return { open: false, text: `${t("closedNow", lang)} · ${t("opens", lang)} ${when} ${t("at", lang)} ${next.time}` };
}

/** Próxima apertura: «hoy», «mañana» o el día que toque, con la hora. */
export type NextOpening = { kind: "today" | "tomorrow" | "day"; day?: DayKey; time: string };

export function nextOpening(hours: WeekHours, timezone: string, date = new Date()): NextOpening | null {
  const now = wallClock(date, timezone);
  const minutes = now.hour * 60 + now.minute;

  for (let offset = 0; offset < 8; offset++) {
    const index = (DAY_KEYS.indexOf(now.key) + offset) % 7;
    const key = DAY_KEYS[index];
    if (!key) continue;
    const d = hours[key];
    if (!d) continue;
    if (offset === 0 && minutesOf(d.open) <= minutes) continue;
    if (offset === 0) return { kind: "today", time: d.open };
    if (offset === 1) return { kind: "tomorrow", time: d.open };
    return { kind: "day", day: key, time: d.open };
  }
  return null;
}

/** Horario de hoy, para mostrarlo en la ficha del bar. */
export function todayHours(hours: WeekHours, timezone: string, date = new Date()) {
  const now = wallClock(date, timezone);
  const d = hours[now.key];
  return d ? `${d.open}–${d.close}` : null;
}
