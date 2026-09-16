# Aprobación de mesas: comandas retenidas, ventana bloqueante e histórico

Sustituye el bloqueo actual: hoy una mesa "pendiente" no deja enviar comandas. Pasará a dejar pedir, reteniendo las comandas hasta que el personal decida.

## 1. Modo de aprobación (administración)

Nuevo selector en Ajustes del bar: **Automática** (por defecto) o **Manual**.

- Automática: la mesa se abre sola, no aparece ninguna ventana y las comandas van directas a barra y cocina.
- Manual: la mesa queda pendiente y se aprueba desde la vista de camarero.

Se puede cambiar en cualquier momento; afecta a las mesas nuevas, no a las ya abiertas.

## 2. Cliente con mesa pendiente

- Puede enviar comandas con normalidad desde el primer momento.
- Sus comandas se muestran con la etiqueta "Pendiente de confirmar" y un aviso de que aún no han llegado a barra ni cocina.
- Si la mesa se rechaza, ese dispositivo sigue viendo el mensaje "Esta mesa no ha sido aceptada. Avisa al camarero." y no puede seguir pidiendo. Un escaneo nuevo desde otro dispositivo abre una mesa nueva pendiente: la mesa no queda bloqueada.

## 3. Barra y cocina

Sólo reciben líneas de mesas aceptadas. Al aceptar o restablecer una mesa, sus comandas retenidas entran en la cola ordenadas por el momento en que el cliente las pidió, igual que el resto.

## 4. Ventana de aprobación en la vista de camarero

Cada mesa pendiente abre una ventana a pantalla completa que bloquea la pantalla, con sonido y vibración al aparecer, y con: número de mesa, apodo del grupo, hora de apertura y el detalle de las comandas enviadas. Botones:

- **Aceptar**: la mesa pasa a abierta y sus comandas entran en cola.
- **Posponer 30 s / 60 s**: se cierra y reaparece pasado ese tiempo (sólo en ese dispositivo).
- **Rechazar**: pide confirmación con el texto "Si rechazas esta mesa, sus comandas no llegarán a barra ni cocina. ¿Confirmar?".

Con varios camareros, la primera decisión gana: al resto se les avisa ("Otro compañero ya ha decidido") y la ventana se cierra. Con varias mesas pendientes, se muestran en cola, una tras otra (la más antigua primero).

## 5. Histórico de sesiones

Nueva pantalla accesible desde camarero y desde administración: mesas rechazadas y cerradas con mesa, apodo, fecha, quién decidió y sus comandas. En una mesa rechazada, botón **Restablecer y aprobar**: pasa a abierta y sus comandas entran en cola.

Las comandas de mesas rechazadas no suman en cuentas ni totales mientras sigan rechazadas.

## Detalles técnicos

Base de datos (migración sin pérdida de datos, sólo añade):

- `session_status` gana el valor `rejected` (ALTER TYPE ADD VALUE; queda `pending | open | rejected | closed`).
- `table_sessions`: nuevas columnas `decided_by uuid`, `decided_at timestamptz`, `decision text CHECK (decision IN ('approved','rejected','restored'))`, `released_at timestamptz`.
- `bar_settings.require_session_approval`: nuevo DEFAULT `false` y actualización del bar existente a `false`.
- `session_is_open(_session_id)` devuelve true para `pending` y `open`, false para `rejected`/`closed`. Las políticas de `orders`, `order_items` y `service_calls` heredan la nueva semántica sin cambiar de texto.
- Nueva función `decide_session(_session_id uuid, _decision text)` SECURITY DEFINER: comprueba `is_staff_of(bar_id)`, actualiza sólo si `status = 'pending'` (approved/rejected) o `status = 'rejected'` (restored) con `WHERE` sobre el estado esperado, escribe `decision`, `decided_by = auth.uid()`, `decided_at`, `released_at` y devuelve el estado resultante o `null` si otro ya decidió. EXECUTE sólo para `authenticated`.
- Lectura del histórico cubierta por las políticas `is_staff_of(bar_id)` existentes; no hacen falta políticas nuevas.

Frontend:

- `QueueBoard` filtra por `table_sessions.status = 'open'` en el join; el orden por llegada sigue siendo `order_items.created_at`, así que las comandas retenidas conservan su orden al liberarse.
- Nuevo `SessionApprovalDialog` en `/camarero`, alimentado por las sesiones `pending` del bar vía realtime, con cola local, mapa de "posponer hasta" en estado, `navigator.vibrate` y un pitido corto con WebAudio (sin fichero de sonido).
- `/m/$token`: se elimina el bloqueo por `status === 'pending'`; etiqueta por comanda y pantalla de mesa rechazada; el cálculo de la cuenta ignora sesiones `rejected`.
- Nueva ruta `/_authenticated/historial` con el listado y el botón Restablecer y aprobar; enlace en la navegación para camarero y administrador.
- Ajustes del bar: el interruptor de aprobación pasa a selector Automática / Manual.
