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
