# Recorrido completo de cada puesto (modo nombre + bar pequeño)

## Preparación del bar de pruebas
- Activar en «Mi Bar»: pedir nombre al escanear el QR y modo Bar pequeño.
- Activar también, solo para la prueba: tapas (Granada y luego Almería), fiado, pago online y modo sin conexión.
- Al terminar, dejar los ajustes como estaban antes de la prueba.

## Recorridos (en móvil, con capturas)
1. **Cliente QR**: escanear, poner nombre, ver la carta, añadir platos con notas y cantidades, enviar. Comprobar que no puede borrar lo ya enviado.
2. **Tapas Granada**: pedir bebidas con y sin tapa, comprobar las rondas (1.ª, 2.ª, ronda a medias, tapas extra cobradas).
3. **Tapas Almería**: elegir tapa con la bebida y comprobar el suplemento en el precio y el ticket.
4. **Barra / bar pequeño**: ver que la cola única recibe bebidas y comida, marcar preparado y servido.
5. **Cocina**: cola de cocina, notas, indicación libre, marcar listo.
6. **Camarero**: mesas con estado, añadir comanda, llamadas de servicio, cuenta «De pie».
7. **Cobrar**: ticket con IVA desglosado, efectivo, Bizum, cierre de mesa.
8. **Dividir la cuenta**: a partes iguales y por grupos, consumo sin asignar bloquea el cierre.
9. **Pago con tarjeta**: pagar una parte con tarjeta de pruebas y confirmar que queda cobrada con ticket.
10. **Fiado**: «A la cuenta de…», sin ticket de cobro, stock sin descontar dos veces, cerrar la cuenta.
11. **Sin conexión**: cortar la red en barra y camarero, marcar líneas y crear comanda, volver la red y confirmar que todo se guarda.

## Corrección
- Cada fallo encontrado se corrige en el mismo turno y se repite el recorrido afectado.
- Se comprueban los importes contra la base de datos (totales, IVA, suplementos, partes).

## Resultado
- Resumen por puesto: funciona / corregido / pendiente con su motivo.

## Detalles técnicos
- Ajustes vía bar_settings (ask_nickname, service_mode, tapa_mode, tabs_enabled, payments_enabled, offline_mode); se guarda el estado original y se restaura.
- Scripts Playwright en /tmp/browser/audit, viewport móvil, sesión de personal con lovable auth-session.
- Verificación de importes con consultas a order_items, bill_split_parts, invoices, customer_tab_lines y stock_movements.
- Pago con tarjeta 4242 en modo pruebas; el webhook debe marcar la parte como pagada.
