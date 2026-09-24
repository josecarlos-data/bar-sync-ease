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
