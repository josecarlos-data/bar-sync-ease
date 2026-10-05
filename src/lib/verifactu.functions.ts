import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Verificación pública de un registro de facturación (Veri*Factu).
 * Lee con clave pública: la tabla permite SELECT anónimo y solo se
 * proyectan los datos que ya aparecen impresos en el ticket.
 */
export const getInvoiceRecord = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabasePublic = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rec } = await supabasePublic
      .from("invoice_records")
      .select("id, bar_id, series, number, kind, total, issued_at, prev_hash, hash, payload")
      .eq("id", data.id)
      .maybeSingle();
    if (!rec) return null;

    // Comprueba el eslabón de la cadena: el registro anterior debe tener
    // el hash que este registro guarda como prev_hash.
    const { data: prev } = await supabasePublic
      .from("invoice_records")
      .select("hash")
      .eq("bar_id", rec.bar_id)
      .lt("issued_at", rec.issued_at)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const chainOk = rec.prev_hash === "" ? !prev : prev?.hash === rec.prev_hash;

    const snap = (rec.payload as { snapshot?: { bar?: { name?: string; legal_name?: string | null; tax_id?: string | null } } })?.snapshot;
    return {
      id: rec.id,
      series: rec.series,
      number: rec.number,
      kind: rec.kind as "simplified" | "full",
      total: Number(rec.total),
      issued_at: rec.issued_at,
      hash: rec.hash,
      prev_hash: rec.prev_hash,
      chainOk,
      bar: {
        name: snap?.bar?.legal_name || snap?.bar?.name || "",
        tax_id: snap?.bar?.tax_id ?? null,
      },
    };
  });
