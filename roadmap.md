# Roadmap — App de pedidos en bares

## Fase 1
- [x] Dirección visual (tema cálido de bar, móvil primero)
- [x] Activar Lovable Cloud y crear modelo de datos multi-bar (bar_id en todas las tablas)
- [x] Ajustes de bar: precios visibles, barra/cocina, camarero pide, tapa, pagos, require_session_approval (true), auto_close_hours (4)
- [x] Admin: artículos (is_drink, tax_rate 10, alérgenos UE 14, precio numeric(10,2)), categorías, mesas + QR, configuración, personal
- [x] Cliente: login anónimo, validación de qr_token en servidor, session_members, catálogo, comandas, llamar camarero, cuenta
- [x] Sesiones de mesa: pending | open | closed, aprobación del personal, cierre automático por inactividad
- [x] Barra y cocina en tiempo real, orden configurable, marcar listo
- [x] Camarero mínimo (/camarero): lista de mesas con estado, llamadas de servicio, cerrar sesión de mesa
- [x] PWA instalable (manifiesto e iconos)

## Aprobación de mesas (completado)

## Voz para indicaciones de cocina (completado)
- Texto de la indicación AI se mantiene; botón de altavoz por indicación en barra/cocina.
- Voz del dispositivo (Web Speech API, es-ES) por defecto; voz IA (AI Gateway TTS, gemini-3.1-flash-tts-preview) opcional en Ajustes.
- Reproducción automática de indicaciones nuevas (por defecto, desactivable en Ajustes); botón "Activar voz" para desbloquear audio del navegador.
- bar_settings: kitchen_voice ('device'|'ai'), kitchen_voice_auto (true).
- [x] Comandas retenidas en mesas pendientes, etiqueta "Pendiente de confirmar" y pantalla de mesa rechazada
- [x] Ventana de aprobación bloqueante en /camarero (aceptar, posponer 30/60 s, rechazar) con sonido y vibración
- [x] Botón "Activar avisos sonoros" en /camarero
- [x] Decisión atómica en base de datos (decide_session) con aviso si otro camarero ya decidió
- [x] Histórico de mesas con "Restablecer y aprobar" y fusión si la mesa ya tiene sesión activa
- [x] Aprobación automática si el camarero añade comanda a una mesa pendiente
- [x] Selector Automática / Manual en ajustes (automática por defecto)

## Fase 2
- [x] División de la cuenta a partes iguales (número de personas e importe por persona)
- [x] División por consumo en grupos, con reparto de lo no asignado o "pendiente con camarero"
- [x] Solicitar cuenta dividida: aviso al camarero y detalle de las partes en /camarero, con marcar parte como cobrada
- [x] Botón de pago por parte (visible con la pasarela activa; falta conectar el proveedor de pago)
- [ ] Camarero completo (añadir/eliminar líneas con registro, servir, cobrar)
- [ ] Tapa gratis con bebida y avisos

## Gestión de personal
- [x] Quitar registro público en /auth
- [x] Acceso con usuario o correo
- [x] Alta de personal desde Personal (usuario, contraseña puesta por el admin, roles)
- [x] Cambiar contraseña, desactivar y borrar cuentas de personal

## Fase 3
- [ ] Pasarela de pago y offline completo

## Impresión y tickets (completado)
- [x] Impresora de cocina configurable (cuándo, zona, ancho) + "Este dispositivo imprime"
- [x] Datos fiscales del bar
- [x] Ticket (factura simplificada) y factura con datos: imprimir, PDF; en Mesas, Histórico y móvil del cliente
- [ ] Envío por email (bloqueado: falta configurar un dominio de correo)
- [ ] Verifactu (fase posterior)

## Existencias (fase 1 completada)
- [x] Ollas/artículos con stock estimado, descuento al pedir, devolución al eliminar línea
- [x] Confirmación al llegar a cero o agotado automático (ajuste en Existencias)
- [x] Panel Existencias: +/−, mitad, poco, recargar, agotar, reabrir, vincular artículos
- [ ] Etiqueta "Últimas unidades" en la carta del cliente
- [ ] Panel de consumo y sugerencias de compra (cuando haya datos)

## Carta (hecho)
- Carta de ejemplo Almería/Granada con grupos y etiquetas
- Carta del móvil: índice de secciones, buscador, filtro de alérgenos, favoritas; orden por grupo alfabético/más vendidos/manual configurable por bar; detalles solo cuando aportan descripción o imagen
- Carta impresa: tríptico, díptico, A4, A5, cartel A3

## Modo bar pequeño
- [x] Ajuste "Forma de trabajar" (Equipo / Bar pequeño)
- [x] Servir todo / servir línea desde la tarjeta de Mesas
- [x] "Ya servido" y "Lo más pedido" al apuntar comanda
- [x] Franja "Por preparar en cocina" en Mesas (bar pequeño)
- [ ] Cuentas de barra sin mesa (varias a la vez) — de momento crear mesas "Barra" en QR

- [x] Cuentas de barra para clientes de pie (pantalla "De pie", sin QR)
