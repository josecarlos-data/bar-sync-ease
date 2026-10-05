# Reponer stock desde el proveedor

## Objetivo
Un botón **«Reponer»** en cada producto de Existencias que pida **cantidad y precio de compra**, suba el stock al momento (y con ello la carta vuelva a mostrar los platos agotados) y deje constancia del gasto.

## Lo que verá el usuario

1. **En Existencias**, cada producto (olla/pool) tendrá un botón **«Reponer»**.
2. Al tocarlo se abre una ventana con:
   - **Cantidad** comprada (en la unidad del producto: kg, litros, cajas…).
   - **Precio total** de la compra (opcional, para llevar la cuenta del gasto).
   - **Proveedor** (ya viene relleno con el proveedor habitual del producto, editable).
3. Al confirmar:
   - Las existencias suben al instante; si el producto estaba agotado, los platos que gastan de él **vuelven a aparecer en la carta** automáticamente.
   - Si el producto estaba en la lista de la compra como pendiente, se marca como comprado.
   - Queda registrado en el historial de movimientos («Compra a Proveedor X: +10 kg, 45 €»).

## Detalles técnicos

- **Nueva RPC `restock_pool(_pool uuid, _qty numeric, _price numeric, _supplier text)`** (security definer, staff del bar):
  - `UPDATE stock_pools SET quantity = quantity + _qty, status='open', updated_at=now()`.
  - `INSERT stock_movements` con `reason='purchase'`, delta=+_qty, created_by=auth.uid(); el precio y proveedor van en el movimiento (columna `note`/payload o en reason ampliado, p. ej. `purchase:45€@Proveedor`).
  - Marca como `bought` cualquier `purchase_items` pendiente ligado a ese pool (mismo criterio que `mark_purchase_bought`).
- **Migración**: solo la función RPC (sin cambios de tablas); GRANT a authenticated.
- **UI — `src/routes/_authenticated/existencias.tsx`**: botón «Reponer» por fila de pool + diálogo (cantidad, precio, proveedor). Reutiliza el estilo de diálogos existente.
- **UI — `src/components/PurchaseList.tsx`**: al marcar «comprado» un artículo ligado a un pool, el diálogo de cantidad gana un campo opcional de **precio**, que se pasa a la misma RPC (o a `mark_purchase_bought` ampliada con `_price`).
- La carta se actualiza sola: la disponibilidad ya se calcula del stock (realtime en `stock_pools`).
- Opcional y sin ajuste nuevo: el botón aparece siempre en Existencias; la lista de la compra sigue detrás de su interruptor actual.

## Pruebas
- Reponer un producto agotado → el plato vuelve a la carta del cliente sin tocar nada más.
- Reponer con precio → el movimiento queda registrado con el gasto.
- Reponer un producto que estaba pendiente en la lista de la compra → desaparece de pendientes.
- `bunx tsgo --noEmit` y build OK.
