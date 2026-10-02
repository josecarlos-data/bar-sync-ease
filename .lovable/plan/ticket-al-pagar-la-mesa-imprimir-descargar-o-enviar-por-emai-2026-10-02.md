# Ticket al pagar la mesa (imprimir, descargar o enviar por email)

Ya existe: ticket con IVA desglosado (base y cuota por tipo), numeración correlativa, imprimir y PDF desde el botón "Ticket". Falta que salga solo al cobrar y el envío por email.

## Qué cambia

1. **Al cobrar, aparece el ticket solo**
   - En Mesas, al pulsar "Cobrada" en una parte, o "Cerrar mesa" con la cuenta completa, se emite el ticket y se abre una ventana "Ticket de la mesa X" con tres botones: **Imprimir**, **Descargar PDF**, **Enviar por email**, más "Factura con datos" si el cliente la pide.
   - El cliente ve en su móvil, en la pestaña Cuenta, "Cuenta pagada" con su ticket listo para descargar o pedir por email.

2. **Desglose de IVA claro en el ticket**
   - Tabla por tipo de IVA (10 %, 21 %...): base imponible, cuota e importe; total con "IVA incluido".

3. **Envío por email**
   - Campo de correo (escrito por el camarero o por el propio cliente); se envía un email con el resumen, el desglose de IVA y un enlace para descargar el PDF (los emails no admiten adjuntos).
   - Se guarda en el ticket a qué correo se envió; en el Histórico se puede reenviar.

## Requisito

Para enviar emails hace falta un dominio propio del negocio (p. ej. avisos@barmendoza.es). Aún no hay ninguno configurado. Imprimir y descargar funcionan sin él; el botón de email aparecerá desactivado con "Configura el correo en Ajustes" hasta que se configure.

## Detalles técnicos

- Configurar dominio de email y generar el sistema de plantillas de la app; plantilla `ticket-receipt` (bar, mesa, número, líneas, desglose IVA, total, enlace).
- Ruta servidor `sendInvoiceEmail` (requireSupabaseAuth o miembro de sesión): valida email con zod, carga la factura por id con RLS, envía con `sendTemplateEmail`, idempotencyKey `invoice-${id}-${email}`, actualiza `invoices.emailed_to`. Límite de envíos por factura.
- Enlace de descarga: ruta pública `/ticket/$id?k=token` con token firmado HMAC (secreto nuevo) que renderiza el ticket y permite PDF.
- camarero.tsx: tras marcar parte pagada o cerrar mesa, llamar `issue_invoice` y abrir InvoiceDialog en modo "recién cobrado".
- InvoiceDialog: sección de email; revisar tabla de IVA en `invoiceHtml` y PDF.
- Sin cambios de esquema (ya existe `emailed_to`).
