# Existencias flexibles + consumo

## Idea principal
El stock es una **estimación que el personal corrige**, no una cuenta exacta. La app avisa, pero quien manda es la cocina o el camarero.

## 1. Tres formas de llevar el stock (por artículo)
- **Sin control** (lo de ahora): solo el botón disponible/agotado.
- **Por unidades**: botellas, latas, postres. Baja 1 por cada unidad pedida.
- **Por preparación (olla)**: por ejemplo, "Carne en salsa — olla de hoy". Varios artículos tiran de la misma olla y cada uno gasta una parte:
  - Tapa de carne en salsa: 1 porción
  - Ración de carne en salsa: 4 porciones
  
  Al hacer la olla, cocina dice "da para unas 16 porciones". Si luego ve que va más rápido o más lento, lo corrige con + / − o con "Queda poco" o "Queda la mitad".

## 2. Qué pasa cuando el stock llega a cero (con confirmación)
Ajuste del bar en Ajustes, **"Al acabarse el stock"**:
- **Preguntar al personal** (por defecto): en Cocina, Barra y Mesas aparece un aviso con sonido: *"Carne en salsa: según los pedidos se ha acabado. ¿Es así?"*
  - **Sí, agotar**: desaparece de la carta del cliente y pasa a "Agotado".
  - **Aún queda**: indicas cuánto queda (rápido: 1, 2, 5, o escribir) y se sigue vendiendo.
  
  Mientras no se responde, el cliente lo sigue viendo con la etiqueta "Últimas unidades", para no perder ventas por un error de cálculo.
- **Agotar automáticamente**: se agota al llegar a cero, sin preguntar.

Además:
- **Aviso de "queda poco"**: cuando baja de un mínimo que tú eliges (por ejemplo, 3), sale un aviso discreto en cocina y barra.
- **Agotar a mano en cualquier momento**: un botón en Cocina, Barra y Mesas para cerrar un artículo o una olla al instante, aunque los números digan que queda. Tiene el mismo efecto inmediato en todos los móviles de los clientes.
- Si el camarero elimina una línea ya pedida, el stock se devuelve.
- Si alguien pide justo cuando no queda (o se agota mientras tenía el carrito), la comanda le avisa: "Ese artículo se acaba de agotar".

## 3. Panel "Existencias" (nueva página para administrador, cocina y barra)
- Lista de ollas y artículos con stock: barra de cuánto queda, + / −, "Recargar" (nueva olla o reposición), "Agotar", "Reabrir".
- Filtros: todo, queda poco, agotados.
- Cada cambio queda registrado: quién, cuándo y por qué (pedido, ajuste manual, nueva olla, merma).

## 4. Panel de consumo (para el administrador)
Con ese registro se calcula:
- Lo vendido por día y por artículo, y a qué hora se agota cada olla.
- **Ollas**: porciones estimadas frente a vendidas. Así se ve si "una olla" da de verdad para 16 o para 12.
- **Mermas y correcciones**: cuánto se ajustó a mano.
- **Sugerencia de compra / producción**: la media de los mismos días de la semana anteriores, por ejemplo "Los viernes gastas unas 2 ollas de carne en salsa y 48 cañas".
- Exportar a CSV.

## Orden de trabajo
1. Stock, ollas, descuento al pedir, confirmación al llegar a cero, panel Existencias y ajustes. Es lo que piedes ahora.
2. Panel de consumo y sugerencias, hecho después, cuando haya unos días de datos.

## Detalles técnicos
- Tabla nueva `stock_pools` (bar_id, name, unit_label, quantity numeric, low_threshold, status open|depleted|confirm_pending, updated_at).
- En `items`: stock_mode ('none'|'unit'|'pool'), stock_qty numeric, low_threshold, pool_id, pool_portions numeric default 1. Una pieza en modo unidad se gestiona como su propia "olla" implícita, para unificar la lógica.
- Tabla `stock_movements` (bar_id, item_id/pool_id, delta, reason 'order'|'order_deleted'|'manual'|'refill'|'waste'|'deplete', order_item_id, created_by, created_at), que sirve para el registro y el consumo.
- `bar_settings.stock_zero_action` ('confirm'|'auto'), con 'confirm' por defecto.
- Un trigger AFTER INSERT en order_items descuenta el stock. Cuando se rellena deleted_at, lo devuelve. Al llegar a ≤0, el artículo pasa a confirm_pending o a available=false, según el ajuste.
- RPCs SECURITY DEFINER (solo personal): adjust_stock, refill_stock, deplete_stock, confirm_depletion(keep_qty).
- Las tablas nuevas tienen GRANTs, RLS por is_staff_of (y lectura para los invitados del bar, solo del estado) y realtime. En la carta del cliente, el aviso "Últimas unidades" se muestra cuando el estado es confirm_pending o queda poco.
- El aviso de confirmación es un componente compartido en QueueBoard y en camarero, con playAlert.
