# Fase 4 — Poner la app al nivel de la competencia

Tras comparar con Waitry, Camarero10, AppCarta/Avocaty y los TPV españoles (Glop, Ágora, Revo), la app ya cubre carta QR, comandas a cocina/barra, división de cuenta, pago con tarjeta, multiidioma y lista de espera — y además tiene cosas que nadie ofrece (tapas Granada/Almería, fiado, Bizum, offline, cuentas de barra). Esto es lo que falta, ordenado por importancia.

## Fase 4A — Veri*Factu y obligaciones fiscales (prioritaria)

Desde 2026 el software de facturación debe generar registros de facturación verificables (RD 1007/2023). Sin esto la app no puede ser la facturación principal de un bar.

- Registro de facturación encadenado (hash encadenado + huella) por cada ticket/factura emitida, con los campos exigidos: NIF, serie+número, fecha, importe, IVA, huella del registro anterior.
- QR en el ticket/factura que apunta a la URL de verificación.
- Exportación/envío de registros (formato Veri*Factu o almacenamiento exportable XML) — valorar si envío directo a AEAT o exportación para el gestor.
- Anotación de anulaciones (los tickets no se borran, se anulan).
- Configurable desde Ajustes: NIF/datos fiscales ya existen en bar_settings; añadir activación del modo Veri*Factu.

## Fase 4B — Informes y estadísticas para el dueño

- Panel "Informes" en admin: ventas por día/semana/mes, ticket medio, productos más vendidos (ya existe menu_popularity), ventas por hora, por camarero y por forma de pago (efectivo/tarjeta/Bizum/fiado).
- Exportación a CSV/Excel del periodo.
- Cierre de caja diario (Z): total por forma de pago, nº de tickets, diferencias.

## Fase 5 (propuesta posterior, no incluida)

- Reservas online con gestión de mesas.
- Fidelización (puntos o tarjeta Wallet).
- Take away / pedido para recoger sin mesa.
- Control horario del personal (fichar entrada/salida).
- Valoración del cliente tras pagar y propina online.

## Qué hará el usuario

- En Ajustes verá el nuevo modo de cumplimiento fiscal y el panel de Informes.
- Los tickets/facturas llevarán el QR de verificación y el encadenamiento será automático.

## Detalles técnicos

- Nueva tabla `invoice_records` (bar_id, invoice_id, hash previo, hash, payload, created_at) con trigger al emitir factura/ticket; nunca UPDATE/DELETE (append-only), GRANTs y RLS como el resto.
- QR de verificación generado en el ticket (ya hay infra de tickets y PDF).
- Informes con RPCs agregadas bar-scoped autenticadas (mismo patrón que menu_popularity).
- Todo opcional y configurable desde Ajustes, apagado por defecto (regla del proyecto).
