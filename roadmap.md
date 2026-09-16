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

## Fase 2
- [ ] Camarero completo (añadir/eliminar líneas con registro, servir, cobrar)
- [ ] División de cuenta, tapa gratis con bebida, avisos

## Fase 3
- [ ] Pasarela de pago y offline completo
