# Existencias y tapas, conectadas

## Qué falla hoy
- **Modo Granada (rondas):** las rondas son solo texto ("1.ª patatas"). La tapa no está ligada a ningún plato ni olla, así que **no descuenta existencias** y, si se acaban las albóndigas, la cocina sigue recibiendo "2.ª tapa".
- **Tapa vs. ración:** un plato descuenta siempre las mismas porciones. Una tapa de carne en salsa gasta lo mismo que una ración, cuando debería gastar mucho menos.
- **Carta del cliente (Almería):** si la olla de una tapa se agota, desaparece, pero no se avisa ni se ofrece otra.

## Qué se va a montar

### 1. Rondas ligadas a la carta (Granada)
- En Ajustes, cada ronda se elige de una lista de platos de la carta (o se deja en texto libre, como ahora).
- Al pedir rondas, cada tapa descuenta de la existencia de ese plato.
- **Si una ronda está agotada**, el camarero lo ve antes de enviar ("2.ª: albóndigas agotadas") y la app propone la siguiente ronda que sí haya. Se puede cambiar con un toque.
- Si se anula la línea, el stock vuelve.

### 2. Porciones distintas para tapa y ración
- En cada plato, junto a "Porciones por unidad pedida", un campo nuevo: **"Porciones como tapa"** (p. ej. ración 1, tapa 0,25).
- Se usa en las tapas incluidas con bebida (Almería) y en las rondas (Granada). Las tapas sueltas que se piden a precio normal gastan como ración.

### 3. Aviso de que queda poca tapa
- En Existencias, cada olla muestra cuántas **tapas** y cuántas **raciones** quedan aproximadamente.
- En la pantalla del camarero, las rondas muestran "quedan ~8 tapas" cuando la existencia baja del mínimo.
- Lo agotado entra en la lista de la compra como cualquier otra existencia.

Todo funciona solo si el bar usa tapa con bebida; con ella apagada no cambia nada.

## Detalles técnicos
- Migración: `items.tapa_portions numeric null` (null = usa `pool_portions`); `order_items.tapa_item_id uuid null` para que las líneas de ronda sin `item_id` apunten al plato de la ronda.
- `bar_settings.tapa_rounds` admite objetos `{ name, item_id }` además de texto (compatibilidad hacia atrás en `roundName`).
- Trigger `order_items_stock`: plato efectivo = `coalesce(item_id, tapa_item_id)`; porciones = `tapa_portions` si `tapa_kind in ('included','round')`, si no `pool_portions`. Igual al anular.
- `src/lib/tapas.ts`: `houseTapaLines` lleva `item_id` de la ronda; nueva función `nextAvailableRound` que salta rondas agotadas (con tests).
- StaffOrderDialog y la carta del cliente pasan `tapa_item_id`; Ajustes con selector de plato por ronda; Artículos con el campo "Porciones como tapa"; Existencias muestra tapas/raciones restantes.
- Prueba: ronda de albóndigas con olla de 2 porciones y tapa 0,5 → 4 tapas descuentan la olla, la 5.ª propone la siguiente ronda.
