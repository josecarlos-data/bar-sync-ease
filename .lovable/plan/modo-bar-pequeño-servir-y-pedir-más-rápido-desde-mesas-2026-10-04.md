# Modo "bar pequeño": servir y pedir más rápido desde Mesas

## Qué pasa ahora
Para servir hay que entrar en la mesa → "Ver comandas" → "Servir comanda completa". Además, si una sola persona lleva todo, tiene que saltar entre Mesas, Barra y Cocina y marcar cada paso (en preparación → preparada → servida). Para un bar de pueblo con una o dos personas son demasiados toques.

## Propuesta

### 1. Ajuste "Forma de trabajar" (Ajustes)
- **Equipo** (actual, temporada alta): barra, cocina y sala separadas, con todos los pasos.
- **Bar pequeño**: una persona lo hace todo. Se saltan pasos intermedios: lo que pide el camarero en barra pasa directo a "servido" si así lo elige, y lo de cocina va a una cola simple.
Se puede cambiar cuando se quiera (p. ej. Equipo el fin de semana).

### 2. Servir con un toque desde la tarjeta de la mesa
- Botón grande **"Servir todo (3)"** directamente en la tarjeta de Mesas cuando hay algo listo o pendiente, sin abrir "Ver comandas".
- Debajo, la lista corta de lo que falta por servir; tocar una línea la sirve.
- "Ver comandas" se queda para el detalle y eliminar líneas.

### 3. Pedido rápido del camarero (clientes sin móvil)
- En "Añadir comanda": botón **"Ya servido"** al enviar (para la caña que se pone al momento), que guarda la comanda como servida sin pasar por la cola de barra.
- Sección **"Lo más pedido"** arriba de la carta del camarero para apuntar en dos toques.
- **Barra sin mesa**: botón "Barra / de pie" para clientes que piden en la barra; abre una cuenta rápida sin QR.

### 4. Pantalla única en modo Bar pequeño
- En Mesas, una franja arriba "Por preparar en cocina" con las líneas pendientes y botón "Listo", para no tener que ir a la pantalla Cocina.

### 5. Orden de la tarjeta
Estado claro en una sola palabra y el botón principal según el estado: Pendiente de aceptar → Aceptar; Listo → Servir todo; Pide la cuenta → Cobrar.

## Lo que no cambia
Roles, permisos, cuenta dividida, tickets, existencias y la carta del cliente.

## Detalles técnicos
- Migración: `bar_settings.service_mode text not null default 'team'` ('team'|'solo').
- Barra sin mesa: crear (si no existe) una mesa especial "Barra" por bar (`tables` con nombre "Barra", sin QR impreso) y permitir varias cuentas abiertas con apodo; usar openSessionForTable con parámetro `allowMultiple`.
- "Ya servido": insertar order_items con status 'served', served_at=now (staff), respetando el trigger de stock.
- Servir todo: update order_items set status='served', served_at where session y status<>'served' y deleted_at null.
- "Lo más pedido": reutilizar useMenuPopularity en StaffOrderDialog/MenuBrowser.
- Franja de cocina: reutilizar la consulta de QueueBoard filtrada a kitchen.
- Verificación con Playwright en móvil con Camarero1.
