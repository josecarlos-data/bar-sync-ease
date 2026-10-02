# Pestaña "Ticket" en el móvil del cliente

Nueva tercera pestaña junto a Carta y Cuenta: **Ticket**. Muestra el ticket provisional de la mesa, con el mismo aspecto que el impreso, y se actualiza solo cada vez que alguien pide, se elimina una línea o cambia la cuenta. No hace falta cerrar la mesa.

## Qué muestra

- Cabecera del negocio: nombre, razón social, NIF y dirección (de Ajustes → Datos del negocio).
- Mesa, apodo, fecha y hora de la última actualización.
- Etiqueta clara: "Ticket provisional — no válido como factura". Así no se confunde con el ticket numerado que se emite al cobrar.
- Artículos agrupados (cantidad × nombre, precio unitario e importe), sin las líneas eliminadas ni las de mesas rechazadas.
- Desglose del IVA por tipo (10 %, 21 %…): base imponible, cuota y total, y el total con "IVA incluido".
- Si la cuenta está dividida, el importe de cada parte y si ya está pagada.
- Botón "Descargar PDF (provisional)" y, cuando ya hay tickets emitidos, el acceso a los definitivos.
- Si el bar tiene los precios ocultos, la pestaña no aparece.

## Detalles técnicos

- `m.$token.tsx`: tab `"ticket"`; se reutiliza la consulta de la cuenta y la escucha en tiempo real que ya existen (order_items, orders, bill_splits, bill_split_parts). Se añade `tax_rate_snapshot` a la consulta.
- Nuevo `src/lib/vat.ts`: `vatBreakdown(lines)` calcula base = total / (1 + tipo), con redondeo a 2 decimales por tipo. Lo mismo se usa en el PDF provisional.
- Nuevo componente `LiveTicket.tsx`, que pinta el ticket en pantalla. El PDF provisional se genera con jspdf usando el mismo formato que `ticket.ts` y la marca "PROVISIONAL".
- Los datos del negocio se leen de `bar_settings`, que el cliente ya puede consultar. Sin cambios en la base de datos.
