# Plan: resumen de comanda del personal ordenado barra → cocina

## Objetivo
En la ventana "Añadir comanda" (mesas y De pie), la listilla de confirmación mostrará primero las bebidas (destino barra) y debajo la comida (destino cocina), con acciones rápidas pensadas para el flujo real: servir las bebidas al momento y enviar la comida a preparar.

## Cambios en `src/components/StaffOrderDialog.tsx`

1. **Listilla agrupada por destino** (paso de confirmación):
   - Sección "🍺 Barra / Bebidas" arriba, sección "🍳 Cocina / Comida" debajo.
   - Si solo hay líneas de un destino, se muestra una sola sección sin cabecera redundante.
   - Se conserva el botón "Eliminar" por línea.

2. **Acciones rápidas según el contenido** (reemplazan los dos botones actuales cuando hay mezcla barra+cocina):
   - **"Servir bebidas y enviar cocina"** (botón principal, destacado): las líneas de barra nacen como servidas (con `ready_at`/`served_at`) y las de cocina van a la cola en estado pendiente. Un solo toque, exactamente el flujo que describes.
   - **"Enviar todo a preparar"**: todo va a su cola (barra y cocina), como hoy.
   - **"Ya servido todo"**: todo nace servido, como hoy.
   - Si la comanda es solo de un destino, se mantienen los dos botones actuales ("Enviar a preparar" / "Ya servido").

3. **Implementación**: reutilizar la función `send()` actual aceptando un modo (`all-queue`, `all-served`, `drinks-served`); en el modo mixto se marca `status: served` solo en líneas con `destination === 'bar'`. Sin cambios en base de datos ni en colas: Barra no verá las bebidas ya servidas y Cocina recibirá la comida normalmente.

## Nota
- No añado desplegable barra/cocina: con las cabeceras de sección y el botón combinado queda más directo y con menos toques.
- El orden de las líneas dentro de cada sección respeta el orden en que se añadieron.
