# Cuenta dividida: comandas nuevas después de dividir

## Qué falla hoy (revisado en el código)
- Cuando la mesa pide la cuenta dividida, la división se "congela": si después piden un café o una copa, esas líneas nuevas no aparecen para repartir en el móvil del cliente.
- El camarero ve el importe guardado en el momento de pedir la cuenta, no el real, y puede pulsar **Cobrada** en cualquier parte aunque haya consumo sin asignar.
- En "partes iguales", el importe de cada persona se calcula una vez y no sube si llegan comandas nuevas.
- El aviso al camarero sí se envía (llega como "pide la cuenta"), pero no hay aviso si aparece consumo nuevo después.

## Cómo quedará

**Regla principal:** el camarero solo puede cobrar cuando todo el consumo está asignado a algún grupo (o dejado "con el camarero").

1. **Comanda nueva tras dividir (por grupos)**
   - Las líneas nuevas aparecen en el móvil en un recuadro **"Nuevo sin asignar"** con +/− por grupo, aunque ya se haya pedido la cuenta.
   - Los grupos ya pagados quedan cerrados (no se les puede añadir nada). Lo nuevo se reparte entre los grupos pendientes, o se crea un grupo nuevo ("Grupo D", p. ej. los que se quedan al café).
   - Botones "Repartir entre los grupos pendientes", "Nuevo grupo" y "Dejar con el camarero" siguen disponibles.
   - Al repartirlo, se vuelve a avisar al camarero ("cuenta actualizada").

2. **Partes iguales**
   - Las personas pagadas quedan fijas. Lo nuevo se reparte solo entre las personas que aún no han pagado; si todas han pagado, se crea una parte nueva "Consumo posterior".

3. **Pantalla del camarero (Mesas)**
   - Importes de cada parte calculados en vivo.
   - Si hay algo sin asignar: aviso en ámbar **"Sin asignar: 6,50 € — pídeles que lo repartan"** y los botones **Cobrada** desactivados (salvo las partes ya pagadas, que siguen como "Pagada").
   - Opción del camarero **"Asignarlo yo"**: mete lo pendiente en "con el camarero" para poder cobrar si el cliente no lo hace.
   - Etiqueta en la tarjeta de la mesa **"Consumo nuevo tras pagar"** cuando ya hay partes pagadas y entra una comanda.

4. **Cerrar la mesa**
   - No se puede cerrar con partes sin cobrar o consumo sin asignar; se muestra qué falta.

5. **Cliente**
   - Mensaje claro: "Habéis pedido algo nuevo: repartidlo para que el camarero pueda cobrar".
   - Las partes pagadas muestran su ticket como hasta ahora.

## Detalles técnicos
- `SplitBill.tsx`: calcular `remainingLines` también con `status='requested'`; mostrar asignación solo para partes `pending`; volver a `requested` + nueva `service_calls` tipo bill tras repartir lo nuevo. Partes iguales: recalcular `amount` de partes `pending` = (total − pagado) / nº pendientes, o insertar parte nueva.
- `camarero.tsx`: cargar asignaciones y líneas para calcular importes y pendiente en vivo; deshabilitar "Cobrada" si pendiente > 0; "Asignarlo yo" reutiliza la lógica de `leaveWithWaiter`; al marcar cobrada, guardar el importe real en `amount` antes de emitir el ticket.
- Bloqueo también en servidor: trigger en `bill_split_parts` que impida pasar a `paid` si hay consumo sin asignar en un split por grupos (evita saltárselo desde otra pantalla), y que impida añadir asignaciones a partes `paid`.
- Realtime: añadir `bill_split_assignments` a la suscripción de camarero (canal con nombre único).
- Prueba Playwright: dividir en 2 grupos → pedir cuenta → cobrar grupo A → nueva comanda → ver "Nuevo sin asignar", Cobrada bloqueado → asignar a grupo B → cobrar.
