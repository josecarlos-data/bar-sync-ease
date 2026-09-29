# Seguimiento de comandas por mesa + panel en tiempo real

## 1. Vista por mesa (camarero/admin)
- En Mesas, al pulsar una mesa se abre su detalle: cada comanda con hora, quién la pidió y sus líneas.
- Cada línea con etiqueta de color: Pendiente, En preparación, Preparada, Servida (eliminadas tachadas).
- Barra de progreso por comanda ("3 de 5 servidas").
- Acciones: marcar línea o comanda completa como servida. Se actualiza sola en tiempo real.

## 2. Panel de comandas en vivo (nueva página "Comandas")
- Tres columnas: Pendientes, En preparación/Preparadas, Servidas (últimas 2 horas).
- Cada tarjeta: mesa + apodo, hora, tiempo transcurrido (se pone ámbar a los 10 min y rojo a los 20).
- Al entrar una comanda nueva: sonido + vibración + tarjeta resaltada unos segundos (usa el botón "Activar avisos sonoros" ya existente).
- Visible para administrador y camarero; filtro por destino (barra/cocina/todo).

## 3. Nuevo estado "En preparación"
- Barra y cocina tendrán un botón "Empezar" por línea/comanda antes de "Listo".
- El cliente también verá "En preparación" en su cuenta.

## Detalles técnicos
- Migración: añadir valor `preparing` al tipo de estado de línea y columna `started_at` en order_items (sin perder datos).
- Componente compartido de estado de línea; realtime sobre orders/order_items/table_sessions.
- Nueva ruta `_authenticated/comandas.tsx` y enlace en el menú; detalle de mesa como panel dentro de camarero.tsx.
- QueueBoard: mostrar líneas pending y preparing, botón "Empezar".

## Ideas que le faltan a la app (para elegir después)
1. Tiempos y estadísticas: ventas del día, platos más pedidos, tiempo medio de cocina, informe de caja al cerrar.
2. Tapa gratis con bebida (ya está el ajuste, falta aplicarlo).
3. Modificadores/variantes: tamaño (caña/tercio), punto de la carne, extras con precio.
4. Traspasar y unir mesas, y mover líneas entre mesas.
5. Stock: agotar un artículo automáticamente al llegar a 0.
6. Carta multiidioma para turistas (traducción con IA).
7. Ticket/factura simplificada imprimible o por email con desglose de IVA.
8. Pago online real (Stripe) por parte de la cuenta.
9. Propinas y valoración del cliente al pagar.
10. Modo sin conexión completo (cola local de pedidos, pendiente de la Fase 3).
11. Horarios y "happy hour" con precios automáticos.
12. Impresión automática de comandas en impresora de cocina.
