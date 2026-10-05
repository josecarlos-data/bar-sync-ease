import { supabase } from "@/integrations/supabase/client";

export type InvoiceRecord = {
  id: string;
  bar_id: string;
  invoice_id: string;
  series: string;
  number: number;
  kind: string;
  total: number;
  issued_at: string;
  prev_hash: string;
  hash: string;
};

/** URL pública de verificación de un registro de facturación. */
export function verificationUrl(recordId: string, baseUrl?: string | null) {
  const base = (baseUrl ?? "").trim() || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/verificar/${recordId}`;
}

/**
 * Busca el registro fiscal encadenado de una factura y genera el QR
 * de verificación. Devuelve null si el bar no tiene Veri*Factu activo
 * o el registro aún no existe.
 */
export async function invoiceQrDataUrl(invoiceId: string, enabled: boolean, baseUrl?: string | null): Promise<string | null> {
  if (!enabled) return null;
  const { data: rec } = await supabase
    .from("invoice_records")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (!rec) return null;
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(verificationUrl(rec.id, baseUrl), { width: 160, margin: 0 });
}
