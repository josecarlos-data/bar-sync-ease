import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ orderId: z.string().uuid(), text: z.string().trim().min(2).max(1000) });

type Result = { ok: true; text: string } | { ok: false; error: string };

export const rewriteKitchenInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id, bar_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "Comanda no encontrada" };
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("bar_id", order.bar_id);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "waiter"))
      return { ok: false, error: "No tienes permiso" };

    const { data: lines } = await supabase
      .from("order_items")
      .select("qty, name_snapshot, note")
      .eq("order_id", order.id)
      .is("deleted_at", null);
    const items = (lines ?? [])
      .map((l) => `- ${l.qty} x ${l.name_snapshot}${l.note ? ` (nota: ${l.note})` : ""}`)
      .join("\n");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "IA no configurada" };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system:
          "Eres el jefe de sala de un bar español. Conviertes indicaciones informales del camarero en instrucciones claras para cocina: frases cortas, en imperativo, en español, máximo 6 líneas. Si hay alergias o intolerancias, ponlas en 'allergy' en MAYÚSCULAS (p. ej. 'SIN GLUTEN (CELÍACO)'), si no, null. No inventes platos ni cambies cantidades; relaciona las indicaciones con los artículos de la comanda cuando corresponda.",
        prompt: `Artículos de la comanda:\n${items || "(sin artículos)"}\n\nIndicación del camarero:\n${data.text}`,
        output: Output.object({
          schema: z.object({ allergy: z.string().nullable(), lines: z.array(z.string()) }),
        }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const out = await result.output;
      const all = [out.allergy ? out.allergy.toUpperCase() : null, ...out.lines.slice(0, 6)]
        .filter((s): s is string => !!s && !!s.trim())
        .map((s) => `• ${s.trim()}`);
      if (!all.length) return { ok: false, error: "La IA no devolvió instrucciones" };
      return { ok: true, text: all.join("\n") };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { ok: false, error: "Sin créditos de IA. Recarga en Ajustes → Planes y créditos." };
      if (status === 429) return { ok: false, error: "Demasiadas peticiones. Prueba en unos segundos." };
      console.error("rewriteKitchenInstruction", e);
      return { ok: false, error: "No se pudo convertir la indicación" };
    }
  });

const SpeakInput = z.object({ text: z.string().trim().min(1).max(1000) });

type SpeakResult = { ok: true; audio: string } | { ok: false; error: string };

export const speakInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SpeakInput.parse(d))
  .handler(async ({ data, context }): Promise<SpeakResult> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(roles ?? []).length) return { ok: false, error: "No tienes permiso" };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "IA no configurada" };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-tts-preview",
          contents: [
            {
              parts: [
                {
                  text: `Lee en voz alta, con voz clara y tono profesional de cocina, en español de España: ${data.text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
            },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("speakInstruction", res.status, body);
        if (res.status === 402)
          return { ok: false, error: "Sin créditos de IA. Recarga en Ajustes → Planes y créditos." };
        if (res.status === 429)
          return { ok: false, error: "Demasiadas peticiones. Prueba en unos segundos." };
        return { ok: false, error: "No se pudo generar la voz" };
      }
      const buf = await res.arrayBuffer();
      return { ok: true, audio: Buffer.from(buf).toString("base64") };
    } catch (e) {
      console.error("speakInstruction", e);
      return { ok: false, error: "No se pudo generar la voz" };
    }
  });

const ALLERGEN_CODES = ["gluten","crustaceos","huevos","pescado","cacahuetes","soja","lacteos","frutos_cascara","apio","mostaza","sesamo","sulfitos","altramuces","moluscos"] as const;
const SuggestInput = z.object({ barId: z.string().uuid(), name: z.string().trim().max(200), ingredients: z.string().trim().min(2).max(2000) });
export type AllergenSuggestion = {
  allergens: { code: (typeof ALLERGEN_CODES)[number]; certainty: "sure" | "doubt"; reason: string }[];
  questions: string[];
  tips: string[];
  description: string | null;
};
type SuggestResult = ({ ok: true } & AllergenSuggestion) | { ok: false; error: string };

export const suggestAllergens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuggestInput.parse(d))
  .handler(async ({ data, context }): Promise<SuggestResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin_of", { _bar_id: data.barId });
    if (!isAdmin) return { ok: false, error: "Solo el administrador puede usar el asistente" };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "IA no configurada" };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system:
          "Eres asesor de seguridad alimentaria para bares en España. Identificas los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011, anexo II; RD 126/2015) a partir de los ingredientes de un plato. Códigos permitidos: " +
          ALLERGEN_CODES.join(", ") +
          ". Reglas: 'sure' si el ingrediente lo contiene claramente; 'doubt' si es habitual que lo contenga según marca o receta (tomate frito, caldos de pastilla, embutidos, salsas comerciales, especias mezcladas). ANTE LA DUDA, INCLÚYELO como 'doubt'. 'reason' corto en español nombrando el ingrediente causante. 'questions': hasta 3 preguntas concretas para resolver dudas. 'tips': hasta 3 consejos prácticos aplicables (revisar etiquetas, freidora compartida, contaminación cruzada se avisa aparte). 'description': descripción breve y apetecible para la carta (máx 90 caracteres) usando los ingredientes, o null. No inventes ingredientes.",
        prompt: `Plato: ${data.name || "(sin nombre)"}\nIngredientes: ${data.ingredients}`,
        output: Output.object({
          schema: z.object({
            allergens: z.array(z.object({ code: z.enum(ALLERGEN_CODES), certainty: z.enum(["sure", "doubt"]), reason: z.string() })),
            questions: z.array(z.string()),
            tips: z.array(z.string()),
            description: z.string().nullable(),
          }),
        }),
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      const seen = new Set<string>();
      const allergens = out.allergens.filter((a) => (seen.has(a.code) ? false : (seen.add(a.code), true)));
      return { ok: true, allergens, questions: out.questions.slice(0, 3), tips: out.tips.slice(0, 3), description: out.description };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { ok: false, error: "Sin créditos de IA. Recarga en Ajustes → Planes y créditos." };
      if (status === 429) return { ok: false, error: "Demasiadas peticiones. Prueba en unos segundos." };
      console.error("suggestAllergens", e);
      return { ok: false, error: "No se pudieron detectar los alérgenos" };
    }
  });
