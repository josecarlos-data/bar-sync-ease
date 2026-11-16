import { supabase } from "@/integrations/supabase/client";

/** Línea que manda el móvil: solo qué y cuánto. Precio, IVA, destino y tapas los pone el servidor. */
export type OrderRequestLine = { item_id: string; qty: number; note?: string | null };
export type ServedMode = "none" | "all" | "drinks";

export type PlaceOrderResult = {
  order_id: string;
  duplicate: boolean;
  total: number;
  lines: { name: string; qty: number; price: number; tapa_kind: string | null; tapa_round: number | null; status: string }[];
  warnings: string[];
};

export function newRequestId() {
  return crypto.randomUUID();
}

/** Traduce los códigos de error del servidor a un texto para la pantalla. */
export function placeOrderErrorMessage(raw: string | undefined | null): string {
  const m = raw ?? "";
  if (m.includes("sold_out:")) {
    const names = m.split("sold_out:")[1]?.split("|").map((s) => s.trim()).filter(Boolean) ?? [];
    return `Agotado: ${names.join(", ")}. Quítalo del pedido para enviarlo.`;
  }
  const lim = m.match(/qty_limit:(\d+)/);
  if (lim) return `Máximo ${lim[1]} unidades por artículo.`;
  if (m.includes("tapas_limit")) return "Máximo 30 tapas por comanda.";
  if (m.includes("too_many_lines")) return "Demasiados artículos distintos en una comanda (máx. 40).";
  if (m.includes("note_too_long")) return "La nota es demasiado larga (máx. 200 caracteres).";
  if (m.includes("session_closed")) return "La mesa ya está cerrada.";
  if (m.includes("item_not_found")) return "Algún artículo ya no está en la carta. Recarga la página.";
  if (m.includes("not_allowed")) return "No tienes permiso para pedir en esta mesa.";
  return "No se pudo enviar la comanda";
}

export async function placeOrder(args: {
  sessionId: string;
  requestId: string;
  lines: OrderRequestLine[];
  tapas?: number | null;
  forceNewRound?: boolean;
  served?: ServedMode;
}): Promise<PlaceOrderResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("place_order", {
    _session_id: args.sessionId,
    _request_id: args.requestId,
    _lines: args.lines.map((l) => ({ item_id: l.item_id, qty: l.qty, note: l.note?.trim() || null })),
    _tapas: args.tapas ?? null,
    _force_new_round: args.forceNewRound ?? false,
    _served: args.served ?? "none",
  });
  if (error) throw new Error(error.message);
  return data as PlaceOrderResult;
}
