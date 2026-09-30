# Impresión de cocina y tickets/facturas para el cliente

## 1. Impresora de cocina (opcional, por bar)
- En Ajustes, nueva sección "Impresora de cocina":
  - Activar/desactivar (desactivado por defecto: quien use tablet no nota nada).
  - Cuándo imprimir: "Al entrar la comanda" o "Al estar preparada".
  - Qué zona imprime: cocina, barra o ambas.
  - Ancho del papel: 58 mm u 80 mm.
- Funcionamiento: un tablet/PC en cocina con la app abierta y la impresora conectada a él. En Barra/Cocina aparece un interruptor "Este dispositivo imprime". Cuando toca, sale el ticket de la comanda: número y apodo de la mesa en grande, hora, cantidades, notas e indicaciones.
- Para que imprima sin preguntar, se muestra una guía corta para configurar el navegador una sola vez (modo quiosco de Chrome). Sin esa configuración, sale la ventana de imprimir y basta con pulsar Aceptar.
- Cada comanda se imprime una sola vez (se marca como impresa), aunque haya varias pantallas abiertas. Botón "Reimprimir" en cada comanda.

## 2. Datos fiscales del bar
- En Ajustes, "Datos del negocio": razón social, NIF, dirección, teléfono, texto al pie del ticket.

## 3. Ticket y factura del cliente
- **Ticket (factura simplificada)**: número correlativo por bar (serie T), fecha, datos del bar, líneas, base e IVA desglosados por tipo, total. Si la cuenta está dividida, un ticket por parte.
- **Factura completa**: si el cliente la pide, se introducen nombre/razón social, NIF y dirección; se crea con serie propia (F).
- Dónde y cómo:
  - Camarero, al cobrar/cerrar la mesa: "Imprimir ticket" y "Factura con datos".
  - Cliente, en la pestaña Cuenta tras pagar/cerrar: "Descargar PDF" y "Enviarme por email".
  - Historial: volver a ver, imprimir o enviar cualquier ticket emitido.
- Una vez emitido, el ticket no cambia (queda guardada una copia de sus datos).

## 4. Email
- El envío por correo necesita configurar un dominio de correo del negocio; lo configuraremos durante la implementación (te aparecerá un paso guiado). Mientras no esté, el botón de email queda oculto y sigue disponible el PDF.

## Aviso legal
- En España, desde 2026 los programas de facturación deben cumplir Verifactu (envío a Hacienda y código QR en el ticket). Este plan deja preparados numeración y datos, pero no incluye la conexión con Hacienda; sería una fase posterior o mediante un proveedor certificado.

## Detalles técnicos
- Migración `bar_settings`: `printer_enabled bool false`, `printer_trigger text ('new'|'ready')`, `printer_scope text ('kitchen'|'bar'|'both')`, `printer_width int (58|80)`, `legal_name, tax_id, address, phone, ticket_footer text`.
- `orders.printed_at timestamptz` + RPC `claim_print(order_id)` atómica (solo actualiza si es null) para evitar duplicados entre dispositivos. Preferencia "este dispositivo imprime" en localStorage.
- Impresión: iframe oculto con HTML de ticket (`@page { size: 80mm auto }`) y `print()`. Disparo desde QueueBoard vía realtime (nueva comanda o todas sus líneas ready).
- Tabla `invoices` (bar_id, session_id, split_part_id, series, number, kind simplified|full, customer_name/tax_id/address, snapshot jsonb con líneas y desglose IVA, totales, created_by, emailed_to). Numeración con función SECURITY DEFINER `issue_invoice` y contador por bar+serie. RLS: personal del bar; miembros de la sesión leen las suyas. GRANTs incluidos.
- PDF generado en el navegador (jspdf) desde el snapshot. Email: plantilla transaccional con enlace/detalle del ticket, enviada desde server fn tras configurar el dominio.
