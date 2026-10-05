import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LANG_NAMES: Record<string, string> = {
  en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", ca: "catalán",
};

const Input = z.object({ barId: z.string().uuid(), langs: z.array(z.enum(["en", "fr", "de", "it", "pt", "ca"])).min(1).max(6) });

type Result = { ok: true; count: number } | { ok: false; error: string };

/** Traduce con IA nombres y descripciones de la carta y los guarda (solo admin). */
export const translateMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabase } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin_of", { _bar_id: data.barId });
    if (!isAdmin) return { ok: false, error: "Solo el administrador puede traducir la carta" };

    const [{ data: items }, { data: cats }] = await Promise.all([
      supabase.from("items").select("id, name, description").eq("bar_id", data.barId),
      supabase.from("categories").select("id, name").eq("bar_id", data.barId),
    ]);
    if (!items?.length && !cats?.length) return { ok: false, error: "La carta está vacía" };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "IA no configurada" };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    let count = 0;
    try {
      for (const lang of data.langs) {
        const { output } = await generateText({
          model: lovable.chat("google/gemini-3-flash-preview"),
          system: `Traduces cartas de bares españoles al ${LANG_NAMES[lang]}. Mantén los nombres propios de platos típicos reconocibles (p. ej. «Patatas bravas» puede quedar igual con una breve aclaración solo en la descripción). No inventes ingredientes. Devuelve todos los ids recibidos.`,
          prompt: JSON.stringify({ categories: cats ?? [], items: items ?? [] }),
          output: Output.object({
            schema: z.object({
              categories: z.array(z.object({ id: z.string(), name: z.string() })),
              items: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable() })),
            }),
          }),
        });
        const itemIds = new Set((items ?? []).map((i) => i.id));
        const catIds = new Set((cats ?? []).map((c) => c.id));
        const now = new Date().toISOString();
        const itemRows = output.items.filter((i) => itemIds.has(i.id)).map((i) => ({
          item_id: i.id, bar_id: data.barId, lang, name: i.name, description: i.description, updated_at: now,
        }));
        const catRows = output.categories.filter((c) => catIds.has(c.id)).map((c) => ({
          category_id: c.id, bar_id: data.barId, lang, name: c.name, updated_at: now,
        }));
        if (itemRows.length) {
          const { error } = await supabase.from("item_translations").upsert(itemRows, { onConflict: "item_id,lang" });
          if (error) return { ok: false, error: error.message };
        }
        if (catRows.length) {
          const { error } = await supabase.from("category_translations").upsert(catRows, { onConflict: "category_id,lang" });
          if (error) return { ok: false, error: error.message };
        }
        count += itemRows.length + catRows.length;
      }
      return { ok: true, count };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { ok: false, error: "Sin créditos de IA. Recarga en Ajustes → Planes y créditos." };
      if (status === 429) return { ok: false, error: "Demasiadas peticiones. Prueba en unos segundos." };
      console.error("translateMenu", e);
      return { ok: false, error: "No se pudo traducir. Prueba de nuevo." };
    }
  });
