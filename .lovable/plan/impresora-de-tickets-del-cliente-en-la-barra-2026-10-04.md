# Impresora de tickets del cliente en la barra

## Qué verá el bar
- **Ajustes → nueva sección "Impresora de tickets (barra)"**, apagada por defecto:
  - **Cuándo imprime:** casillas que se pueden combinar:
    - **Al pedir la cuenta**: sale el ticket provisional (con IVA desglosado) para llevarlo a la mesa.
    - **Al cobrar**: sale el ticket definitivo cuando se marca cobrada una parte o se cierra la mesa / cuenta de pie.
    - Si no marcas ninguna, solo se imprime **a petición** con el botón.
  - **Ancho de papel:** 58 u 80 mm.
- **En la pantalla Barra** (y en Mesas para el camarero): interruptor **"Este dispositivo imprime tickets"**, igual que el de la impresora de cocina. Solo imprime el dispositivo que lo tenga activado; si hay varias pantallas, cada ticket sale una sola vez.
- **Botón "Imprimir en barra"** en Mesas (cada mesa abierta), en «De pie» y en la ventana del ticket: manda el ticket a la impresora de la barra desde cualquier móvil del personal.
- Con la cuenta dividida, sale un ticket por parte.

## Detalles técnicos
- Migración:
  - `bar_settings.ticket_printer_enabled boolean DEFAULT false`, `ticket_print_on_bill boolean DEFAULT true`, `ticket_print_on_paid boolean DEFAULT true`, `ticket_printer_width int DEFAULT 80`.
  - Tabla `print_jobs` (id, bar_id, session_id, invoice_id nullable, split_part_id nullable, kind 'provisional'|'final', created_by, created_at, printed_at) con GRANT a authenticated/service_role, RLS: staff del bar lee/inserta; realtime.
  - RPC `claim_print_job(_id)` SECURITY DEFINER (staff), marca printed_at de forma atómica (mismo patrón que `claim_print`).
  - Trigger en `service_calls` (INSERT type='bill') que crea un job 'provisional' si `ticket_printer_enabled` y `ticket_print_on_bill`. Trigger en `invoices` (INSERT) que crea un job 'final' si `ticket_print_on_paid`.
- Nuevo `TicketPrintAgent.tsx` (interruptor localStorage `comandas:this-device-prints-tickets`): escucha `print_jobs` pendientes, reclama con la RPC y genera el HTML con `invoiceHtml` (final) o un `provisionalTicketHtml` nuevo en `ticket.ts` reutilizando `vatBreakdown`; imprime con `printHtml(width)`.
- Montarlo en `/barra` y `/camarero`; botón "Imprimir en barra" inserta un job (`provisional` o `final` si ya hay factura).
- `admin.ajustes.tsx`: sección nueva; `types.ts` actualizado.
