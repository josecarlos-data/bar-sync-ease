# Carta completa de Almería/Granada, carta imprimible y mejor carta en el móvil

## 1. Carta de ejemplo más potente (Almería, Granada y zona)
Antes de crearla, consulto en internet cartas de bares de referencia (Almería: Casa Puga, Entrefinos, Tito's, Bodega Las Botas; Granada: Los Diamantes, Bodegas Castañeda, La Riviera, Bar Poë…) y monto una carta de unos 80-90 artículos con precio, descripción breve, destino (barra/cocina), IVA y alérgenos (gluten, sulfitos, lácteos, huevo, pescado, moluscos…).

Estructura propuesta (secciones y grupos dentro de cada sección):
- **Bebidas**: Cervezas (Alhambra, Mahou, sin alcohol…), Vinos (tinto, blanco, rosado, dulce), Vermut y finos, Refrescos y aguas, Cafés e infusiones, Copas.
- **Tapas**: Frías (ensaladilla, remojón, pipirrana, aliño, gurullos fríos no), Calientes (albóndigas, migas, gurullos, carne en salsa, patatas a lo pobre, choto al ajillo), Pescado (boquerones, gambas al pil-pil, calamar, pulpo), Especiales (con suplemento).
- **Raciones**: Cerdo (secreto, presa, lomo en manteca, chorizo y morcilla de la Alpujarra), Ternera, Choto/cordero, Pollo, Pescado y marisco (gamba roja de Garrucha, quisquilla de Motril, fritura, rosada), Verduras.
- **Para compartir / platos de la zona**: plato alpujarreño, habas con jamón, berenjenas con miel de caña, tortilla del Sacromonte, choto, migas, jamón y quesos.
- **Postres**: piononos de Santa Fe, tocino de cielo, flan casero, helado.

Se carga en "Mi Bar" sustituyendo la carta de prueba actual (los pedidos antiguos no se tocan). Los nombres de bares solo sirven de referencia: no se copian sus cartas.

## 2. Grupos dentro de cada sección
- Cada artículo podrá tener un **grupo** opcional (p. ej. "Cerdo", "Ternera", "Frías", "Calientes") y una etiqueta opcional: **Especial / Casera / Picante / Vegetariana / Nuevo**.
- En Admin → Artículos: campo grupo (con sugerencias de los ya usados), ordenar secciones y grupos subiendo/bajando, y vista agrupada.

## 3. Carta del móvil (QR) más cómoda
- **Barra de secciones fija arriba** que se desplaza sola y marca dónde estás ("Tapas › Calientes"). Al tocarla, salta a esa sección.
- **Buscador** ("gambas", "sin gluten").
- **Ordenar**: por grupo (por defecto) o alfabético.
- **Filtros por alérgeno**: "Sin gluten", "Sin lácteos", etc., oculta lo que lo contiene.
- **Favoritas**: corazón en cada artículo; aparecen en un bloque "Mis favoritas" arriba del todo con su +/−. Se guardan en el móvil durante la sesión de la mesa (se borran al cerrarla).
- Tarjetas más compactas: nombre, precio, iconos de alérgenos y etiqueta; al tocar se abre la ficha con foto, descripción y nota.
- El carrito sigue fijo abajo con el total y "Enviar comanda". El mismo diseño se usa al añadir comanda desde el panel del camarero.

## 4. Diseño de carta imprimible (nueva sección "Carta impresa")
Nueva página en el panel de administrador, basada siempre en la carta actual:
- **Formatos**: tríptico A4 (plegado en 3, dos caras), díptico A4/A3, hoja A4 a una cara, carta de mesa A5, y cartel A3 de pizarra.
- **Estilos**: 3 plantillas (Clásica/taberna, Moderna, Pizarra), color principal y tipografía.
- **Opciones**: mostrar precios, mostrar alérgenos (con leyenda de los 14), incluir/excluir secciones, texto de portada (nombre, eslogan, dirección, horario) y un QR opcional a la carta digital.
- Vista previa en pantalla con las caras del tríptico, y botones **Imprimir** y **Descargar PDF** listo para imprenta (márgenes, marcas de plegado y sangrado de 3 mm).
- Los artículos agotados no se ocultan en la impresa (es una carta fija).

## Detalles técnicos
- Migración: `items.group_name text`, `items.tags text[] default '{}'`, `categories.group_order text[]` (orden de grupos); índice por (bar_id, category_id, group_name). Nueva tabla `menu_print_settings` (bar_id PK, format, template, colors, options jsonb) con GRANT + RLS solo admin del bar.
- Carga de la carta de ejemplo con una migración de datos para el bar de ejemplo (borra items sin pedidos y desvincula del resto con `available=false`).
- Cliente: componente `MenuBrowser` compartido (m.$token y StaffOrderDialog) con IntersectionObserver para la sección activa; favoritas en `localStorage` con clave por sesión.
- Imprimible: ruta `/admin/carta-impresa`, maquetación HTML/CSS con `@page` (A4 apaisado para tríptico, 3 columnas por cara) y PDF con `window.print`; enlace en el menú admin.
- Imágenes de artículos: se quedan como están (sin fotos nuevas generadas en esta fase).
