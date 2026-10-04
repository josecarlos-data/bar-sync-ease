# Arreglar el orden de la carta y llevarlo a la carta impresa

## Qué falla
- En el panel **Carta**, los botones Alfabético / Más vendidos / Manual se guardan, pero la lista del propio panel siempre se pinta en orden manual. Por eso parece que no hace nada.
- La carta impresa ignora ese ajuste y usa siempre el orden manual.
- En el móvil del cliente, "Más vendidos" puede no tener datos de ventas (el cálculo solo lo puede pedir el personal) y vuelve en silencio a la A-Z.

## Cambios
1. **Panel Carta**: la lista se reordena al momento según el botón elegido. Las flechas de subir/bajar solo salen en modo **Manual** (en los otros modos un aviso: "Cambia a Manual para ordenar a mano"). En Más vendidos se ve el nº de unidades de los últimos 30 días junto a cada artículo.
2. **Carta del móvil (QR)**: "Más vendidos" funciona también para clientes, con un cálculo que solo devuelve la clasificación de artículos (no comandas ni datos de clientes). El botón del cliente Por grupo / A-Z se mantiene.
3. **Carta impresa**: nueva opción "Orden de los artículos": **Igual que la carta virtual** (por defecto), Alfabético, Más vendidos o Manual. Se guarda con el resto del diseño impreso. Secciones y grupos mantienen su orden.
4. Comprobar en pantalla los tres modos en panel, móvil e impresa.

## Detalles técnicos
- `admin.articulos.tsx`: `buildSections(categories, items, settings.menu_sort, popularity)` con la misma consulta de popularidad que `MenuBrowser` (extraer hook `useMenuPopularity`).
- `menu_popularity`: permitir guests del bar (`is_guest_of_bar` o `can_view_bar`) además del staff; solo devuelve item_id + units agregados.
- `admin.carta-impresa.tsx`: `menu_print.sort` ("inherit" | MenuSort), pasar a `buildSections`.
