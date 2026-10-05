# Existencias ligadas a la carta y a la lista de la compra

## Situación actual
- Existencias es una lista suelta de "ollas" creada a mano; los platos se enlazan uno a uno dentro de cada olla.
- Un plato de la carta no muestra su stock, y desde Artículos no se puede crear ni ver su existencia.
- La lista de la compra tiene interruptor en Ajustes, pero no existe ninguna pantalla: no hace nada.

## Qué se va a montar

### 1. Carta y existencias, en los dos sentidos
- **En Artículos**, cada plato muestra su existencia ("Quedan 12", "Agotado") y una opción "Controlar existencias":
  - por unidades (botellas, latas, croquetas): se crea su existencia automáticamente;
  - o gastando de una olla compartida (p. ej. "Carne en salsa", 1 ración por tapa, 2 por plato).
- **En Existencias**, cada olla lista sus platos, y se pueden añadir platos de la carta desde ahí.
- Agotar en Existencias quita el plato de la carta al instante; reabrir lo vuelve a poner. Marcar "No disponible" en Artículos se refleja en Existencias.
- Filtro por sección de la carta (Bebidas, Tapas…) y buscador.

### 2. Lista de la compra conectada
- Cada existencia puede tener un **mínimo** y una **cantidad ideal** (lo que quieres tener tras comprar) y un proveedor opcional.
- Cuando algo baja del mínimo o se agota, **entra solo en la lista de la compra** con la cantidad sugerida (ideal − lo que queda).
- También se pueden añadir cosas a mano (lejía, servilletas) que no son de la carta.
- Al marcar "Comprado" con la cantidad real, **la existencia se recarga sola** y el plato vuelve a la carta si estaba agotado.
- La lista se puede agrupar por proveedor y compartir por WhatsApp o imprimir.
- Visible para administrador, barra y cocina; se activa con el interruptor de Ajustes que ya existe (apagado por defecto).

### 3. Pantalla de Existencias más clara
- Resumen arriba: agotados, queda poco, en la lista de compra.
- Pestañas: Existencias | Lista de la compra.
- Historial breve por existencia (ventas, recargas, ajustes) para entender por qué bajó.

## Detalles técnicos
- Migración: `stock_pools` + `target_qty numeric`, `supplier text`, `item_id uuid` (existencia por unidades de un plato); nueva tabla `purchase_items` (bar_id, pool_id nullable, name, qty, unit_label, supplier, status pending|bought, created_by, bought_at) con GRANTs y RLS `is_staff_of`.
- Trigger en `stock_pools` tras cambio de cantidad/estado: si queda ≤ low_threshold o agotado y la lista está activa, inserta/actualiza la línea pendiente (sin duplicar).
- RPC `mark_purchase_bought(_id, _qty)`: marca comprado y llama a `stock_action(... 'refill')` en una transacción.
- Sincronizar `items.available` con el estado de la existencia vinculada (reutilizar la lógica de agotado actual).
- Artículos: bloque "Existencias" en el editor del plato; Existencias: pestañas y alta de platos desde la olla. Realtime en ambas.
