# Ejemplos de alérgenos visibles en móvil y tablet

## Contexto
Los ejemplos de cada alérgeno ("Frutos de cáscara: almendra, avellana…") se muestran hoy con el atributo nativo `title` del botón en **Carta → Artículo** (`src/routes/_authenticated/admin.articulos.tsx`, línea 383). Ese atributo solo funciona al pasar el ratón: en móvil y tablet no se ve nunca. Uso principal previsto: móvil/tablet.

## Cambios

1. **Chips de alérgenos (Carta → Artículo)**
   - Añadir junto al título "Alérgenos" un pequeño botón de ayuda (icono "?") que abre un panel/desplegable con la lista completa: los 14 alérgenos con su nombre y ejemplos.
   - El panel se abre y cierra con un toque (funciona en móvil, tablet y escritorio); se mantiene también el `title` para escritorio.
   - Cada entrada de la lista indica si está marcada en el artículo actual.

2. **Nada más cambia**: el asistente de alérgenos, los chips de marcado, el asistente de sugerencias y la carta del cliente quedan igual.

## Verificación
- Compilar sin errores (`bunx tsgo --noEmit`).
- Probar en el preview móvil/tablet que el botón "?" abre la lista y que marcar/desmarcar sigue funcionando igual.
