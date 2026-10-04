# Alérgenos: comprobación legal y asistente al crear artículos

## 1. Comprobación legal (hecha)
La lista de la app es correcta y está completa. La ley sigue exigiendo **14 alérgenos** (Reglamento UE 1169/2011, anexo II; en España, RD 126/2015 para comida sin envasar como la de un bar):
gluten (cereales), crustáceos, huevos, pescado, cacahuetes, soja, leche/lácteos, frutos de cáscara, apio, mostaza, sésamo, sulfitos (más de 10 mg/kg), altramuces y moluscos.
Los últimos cambios (2024) solo eximen ciertos derivados muy refinados (p. ej. un emulgente de mostaza); no hay alérgenos nuevos. Los 14 de la app ya coinciden.

Pequeñas mejoras de texto: que el nombre de cada alérgeno en el panel muestre ejemplos ("Gluten: trigo, cebada, centeno, avena, espelta…", "Frutos de cáscara: almendra, avellana, nuez…") para que el bar no dude.

## 2. Asistente de alérgenos al crear o editar un artículo
En la ventana del artículo (Carta → Nuevo / Editar), nueva sección **"Ingredientes y alérgenos con ayuda"**:

1. El bar escribe los ingredientes como le salgan: "carne de cerdo, tomate frito, vino blanco, pimentón, pan rallado, ajo".
2. Pulsa **Detectar alérgenos**. La IA devuelve:
   - **Seguros**: alérgeno + por qué ("Gluten — pan rallado", "Sulfitos — vino blanco").
   - **Dudosos**: "Puede llevar gluten — el tomate frito comercial a veces lleva harina; revisa la etiqueta". **Ante la duda, quedan marcados**, y el bar los quita si comprueba que no.
   - Preguntas para salir de dudas ("¿El caldo es casero o de pastilla?").
   - Propuesta de descripción corta para la carta (opcional, botón "Usar").
3. Los alérgenos sugeridos se marcan en las casillas de siempre, con una etiqueta "sugerido por IA" hasta que el bar guarda. Nada se guarda sin que él lo confirme.
4. Los ingredientes quedan guardados en el artículo (útiles si lo pide un cliente o un inspector) y no se muestran al cliente salvo que se escriban en la descripción.
5. Aviso fijo: "Orientativo. La responsabilidad final es del establecimiento; revisa las etiquetas de los productos que compras."

Consejos que da el asistente siempre que apliquen: revisar etiquetas de salsas, caldos y embutidos; freidora compartida con pescado o rebozados; vino y vinagre = sulfitos; las trazas por contaminación cruzada se avisan aparte, no como ingrediente.

## Detalles técnicos
- Migración: `items.ingredients text` (nullable).
- `src/lib/allergens.ts`: añadir `examples` a cada alérgeno.
- Nueva server fn `suggestAllergens` en `src/lib/kitchen.functions.ts` (requireSupabaseAuth + is_admin_of), Lovable AI Gateway, salida estructurada `{ allergens: [{code, certainty: "sure"|"doubt", reason}], questions: string[], description?: string, tips: string[] }`, codes limitados al enum `allergen`; prompt con la lista oficial y la regla "ante la duda, incluir"; errores 402/429 legibles.
- `admin.articulos.tsx`: bloque del asistente en el diálogo; une sugerencias con las casillas existentes.
