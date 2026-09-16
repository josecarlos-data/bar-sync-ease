# Aprobación de mesas: comandas retenidas, ventana bloqueante e histórico

Sustituye el bloqueo actual: hoy una mesa "pendiente" no deja enviar comandas. Pasará a dejar pedir, reteniendo las comandas hasta que el personal decida.

## 1. Cliente con mesa pendiente

- Puede enviar comandas con normalidad desde el primer momento.
- Sus comandas se muestran con la etiqueta "Pendiente de confirmar" y un aviso de que aún no han llegado a barra ni cocina.
- Si la mesa se rechaza, ve un mensaje claro: "Esta mesa no ha sido aceptada. Avisa al camarero." y no puede seguir pidiendo.

## 2. Barra y cocina

Sólo reciben líneas de mesas aceptadas. Al aceptar una mesa, todas sus comandas retenidas entran en la cola respetando su orden de envío original.

## 3. Ventana de aprobación en la vista de camarero

Cada mesa pendiente abre una ventana a pantalla completa que bloquea la pantalla, con: número de mesa, apodo del grupo, hora de apertura y el detalle de las comandas enviadas. Botones:

- **Aceptar**: la mesa pasa a abierta y sus comandas entran en cola.
- **Posponer 30 s / 60 s**: se cierra y reaparece pasado ese tiempo (sólo en ese dispositivo).
- **Rechazar**: pide confirmación con el texto "Si rechazas esta mesa, sus comandas no llegarán a barra ni cocina. ¿Confirmar?".

Con varios camareros, la primera decisión se propaga en tiempo real y la ventana desaparece en el resto. Con varias mesas pendientes, se muestran en cola, una tras otra (la más antigua primero).

## 4. Histórico de sesiones

Nueva pantalla accesible desde camarero y desde administración: mesas rechazadas y cerradas con mesa, apodo, fecha, quién decidió y sus comandas. En una mesa rechazada, botón **Restablecer y aprobar**: pasa a abierta y sus comandas entran en cola en ese momento.

## Detalles técnicos

Base de datos (migración sin pérdida de datos, sólo añade):

- `session_status` gana el valor `rejected` (ALTER TYPE ADD VALUE; queda `pending | open | rejected | closed`).
- `table_sessions`: nuevas columnas `decided_by uuid`, `decided_at timestamptz`, `decision text CHECK (decision IN ('approved','rejected','restored'))`, `released_at timestamptz` (momento en que las comandas retenidas se liberan a la cola).
- `session_is_open(_session_id)` pasa a devolver true para `pending` y `open` (permite pedir estando pendiente) y false para `rejected`/`closed`. Las políticas de `orders`, `order_items` y `service_calls` no cambian de texto: heredan la nueva semántica.
- Las políticas de lectura del personal ya cubren el histórico (`is_staff_of(bar_id)`); no hacen falta políticas nuevas. La actualización de la sesión sigue reservada al personal del bar.
- `bar_settings.require_session_approval` se mantiene: si está desactivado, la sesión nace `open` y no hay ventana.

Frontend:

- `QueueBoard` (barra/cocina) filtra por `table_sessions.status = 'open'` en el join; el orden por llegada sigue siendo `order_items.created_at`, por lo que las comandas retenidas conservan su orden al liberarse.
- Nuevo `SessionApprovalDialog` montado en `/camarero`, alimentado por las sesiones `pending` del bar vía realtime, con cola local y mapa de "posponer hasta" en estado del componente.
- `/m/$token`: se elimina el bloqueo por `status === 'pending'`; se añade etiqueta por comanda y pantalla de mesa rechazada.
- Nueva ruta `/_authenticated/historial` con el listado y el botón Restablecer y aprobar; enlace en la navegación del personal para camarero y administrador.
- Aceptar / rechazar / restablecer escriben `status`, `decision`, `decided_by`, `decided_at` y (al aceptar o restablecer) `released_at` en una sola actualización.
