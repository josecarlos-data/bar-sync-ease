# Cuentas de barra (clientes de pie, sin mesa ni QR)

## Qué verá el personal
- Nueva pestaña **"Barra / de pie"** en el panel (admin, camarero y barra; también en modo Bar pequeño).
- Botón grande **"Nueva cuenta"**: nombre opcional ("Paco", "Chico gorra"…). Si no se pone, sale "Barra 1", "Barra 2"…
- Lista de cuentas abiertas en tarjetas: nombre, hora, total, platos que faltan por servir y botón **"Servir todo"**.
- En cada tarjeta:
  - **Añadir** — abre la misma carta del personal ("Lo más pedido", "Enviar a preparar" / "Ya servido").
  - **Ver comandas** — detalle, servir o eliminar líneas (como en Mesas).
  - **Cobrar** — muestra el total, abre el ticket con IVA desglosado (imprimir / PDF / factura con datos) y cierra la cuenta.
- Opción **"Cobrar ya"** al enviar: para quien pide y paga en el momento (apunta, marca servido, cobra y cierra en un paso).
- Barra y Cocina reciben las comandas igual que las de mesa, mostrando "Barra · Paco" en lugar de número de mesa.
- Las cuentas de barra no aparecen en la lista de Mesas ni en la página de QR; sí en Histórico y en los tickets.

## Qué no cambia
- Mesas, QR, división de cuenta, existencias, impresora y voz siguen igual; las comandas de barra descuentan stock e imprimen como cualquier otra.
- Los clientes no pueden entrar en estas cuentas (no hay QR).

## Detalles técnicos
- Migración: `tables.kind text NOT NULL DEFAULT 'table'` con CHECK ('table'|'counter'). Cada cuenta de barra es una mesa interna `kind='counter'` (número 900+, `qr_token` aleatorio nunca mostrado). Al cerrar queda libre y se reutiliza para la siguiente cuenta; así todas las vistas existentes (cola, ticket, histórico, issue_invoice, stock) funcionan sin cambios.
- Nuevo server fn `openCounterAccount({ nickname? })` en `bar.functions.ts` (requireSupabaseAuth, staff del bar): busca una mesa counter libre o crea una, abre sesión `open` con apodo. Respeta `waiter_can_order`.
- `admin.mesas.tsx` y `camarero.tsx` filtran `kind='table'`; `joinTable` rechaza tokens de mesas counter.
- Nueva ruta `src/routes/_authenticated/barra-pie.tsx` (o similar) con realtime de sesiones/líneas counter; reutiliza `StaffOrderDialog`, `TableOrdersDialog`, `InvoiceDialog` y la lógica de cierre/cobro de `camarero.tsx` (extraída a helper compartido).
- `StaffShell`: entrada de navegación nueva. QueueBoard/LiveTicket: etiqueta "Barra · apodo" cuando `kind='counter'`.
- Actualizar roadmap.md (cierra el pendiente "cuentas de barra sin mesa") y AGENTS.md con la regla de mesas internas counter.
