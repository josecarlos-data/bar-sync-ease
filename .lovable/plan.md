# Indicaciones a cocina asistidas por IA

## Qué verá el personal
- En **Mesas** (camarero), cada mesa abierta con comandas tiene un botón **"Indicación a cocina"**.
- Se abre una ventana: se elige la comanda (por defecto, la última enviada) y se escribe la indicación con sus palabras, p. ej. *"el niño es celiaco y la carne que no esté muy hecha, que tarden un poco las raciones"*.
- Botón **"Convertir"**: la IA devuelve instrucciones claras, cortas y en imperativo, p. ej.:
  - SIN GLUTEN (celíaco) – toda la comanda
  - Carne: punto menos hecho
  - Raciones: retrasar salida
- El camarero puede **editar** el texto antes de enviarlo, o enviar la indicación original sin convertir.
- Al enviar, la indicación aparece destacada (recuadro de aviso) en la tarjeta de esa comanda en **Cocina** y **Barra**, en tiempo real.
- Si la IA falla (sin créditos, límite, error), se muestra un mensaje claro y se conserva el texto escrito.

## Reglas
- Solo personal del bar (administrador, camarero) puede crearlas; cocina y barra las ven.
- Las alergias se marcan siempre en primera línea y en mayúsculas.
- La IA no inventa platos ni cambia cantidades; solo reformula lo escrito y lo relaciona con los artículos de la comanda.
- Queda registro de quién la escribió, cuándo, el texto original y el convertido.

## Detalles técnicos
- Migración: tabla `order_instructions` (id, bar_id, order_id, original_text, instruction_text, created_by, created_at) con GRANT, RLS (`is_staff_of(bar_id)` para leer; insertar solo admin/waiter), REPLICA IDENTITY FULL y publicación realtime.
- `src/lib/ai-gateway.server.ts`: helper `createLovableAiGatewayRunIdFetch`.
- `src/lib/kitchen.functions.ts`: `rewriteKitchenInstruction` (createServerFn + requireSupabaseAuth, comprueba rol de staff, carga los artículos de la comanda) usando `openai/gpt-6-astra` por Responses API con `streamText` + `Output.object({ lines: string[], allergy: string|null })`, reasoning `low`, `store: false`. Errores 402/429 devueltos con mensaje legible.
- Nuevo componente `KitchenInstructionDialog` en `/camarero`.
- `QueueBoard`: consulta las instrucciones de las comandas visibles, las muestra en `OrderCard`; añade `order_instructions` a la suscripción realtime.
- Aprovisionar `LOVABLE_API_KEY` si falta y probar una llamada real.
