# Hallazgo 1 — El precio lo pone el servidor y la comanda se guarda entera

## Veredicto: CONFIRMADO, y es más grave de lo que dice el revisor

### Prueba 1 — Reglas de acceso reales (consultadas en la base de datos)
```text
order_items_insert  INSERT  {authenticated}
  WITH CHECK: EXISTS (SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND session_is_open(o.session_id)
      AND (is_staff_of(o.bar_id) OR is_session_member(o.session_id)))

orders_insert  INSERT  {authenticated}
  WITH CHECK: session_is_open(session_id)
    AND (is_staff_of(bar_id) OR is_session_member(session_id))
```
No se comprueba precio, artículo, disponibilidad ni que `order_items.bar_id` coincida con el de la comanda.

### Prueba 2 — Permisos y restricciones reales
```text
has_table_privilege INSERT: orders anon=true, authenticated=true
                            order_items anon=true, authenticated=true
Única restricción en order_items: CHECK (qty > 0)
orders.created_by_role por defecto 'client'   (el cliente puede enviar otro valor)
order_items.status por defecto 'pending'       (el cliente puede enviar otro valor)
```

### Prueba 3 — Código
- `src/routes/m.$token.tsx` líneas 308-357: el móvil del cliente inserta `orders` y después `order_items` con `price_snapshot: line.price`, `name_snapshot`, `tax_rate_snapshot`, `destination` y `tapa_kind` calculados en el navegador. Si falla el segundo paso, la comanda queda vacía.
- `src/components/StaffOrderDialog.tsx` líneas 187-202 y `src/lib/offline.ts` líneas 165-180: el personal hace los mismos dos pasos.

### Lo que añado al hallazgo del revisor
1. **El cliente puede saltarse la aprobación de mesa.** Si envía `created_by_role: 'waiter'`, el disparador `auto_approve_on_staff_order` abre su sesión sin que el camarero la apruebe.
2. **El cliente puede enviar líneas ya marcadas como «servidas»** (o con `deleted_at`). No pasarían por cocina y podrían no cobrarse bien.
3. **Reintentos sin red:** si la red se corta tras guardar, al reintentar la comanda puede entrar dos veces. Hoy no hay nada que lo impida.

No he lanzado un pedido manipulado contra la base real para no ensuciar los datos. Las tres pruebas de arriba bastan para demostrarlo. Durante la implementación lo reproduciré antes del arreglo y repetiré después, en una mesa de prueba que luego cerraré.

## Respuesta a «Para rebatir»

**Función única con lógica en el servidor, no un disparador que filtre precios.** Un disparador que acepte «el precio de carta, 0, el suplemento o la tapa extra» sigue dejando que el cliente elija el más barato: pedir 5 platos como «incluidos» a 0 € o al suplemento aunque solo tenga 1 bebida. Para impedirlo, el disparador tendría que contar bebidas y rondas, es decir, la misma lógica, pero repartida fila a fila y peor. La función es más segura y además más fácil de mantener, porque las reglas quedan en un solo sitio.

**Cómo llevar las reglas de tapa sin duplicarlas mal:**
- El servidor manda. Calcula bebidas con tapa, el cupo de Almería, las rondas de Granada, el salto de rondas agotadas y el precio de la tapa extra.
- El móvil solo envía lo que el camarero decide de verdad: artículos, cantidades y notas. En modo Granada envía además cuántas tapas quiere poner y si fuerza una ronda nueva.
- `src/lib/tapas.ts` se queda solo para mostrar la vista previa en pantalla.
- Una prueba automática compara la vista previa con lo que devuelve el servidor en los casos ya acordados: 2 cañas + agua dan 2 primeras; 2 cañas más dan 2 segundas; 3 tapas con 2 bebidas dan 1 extra a 1,50 €; Almería con 2 bebidas da «2 de 2» y cobra el suplemento.
- Si algún día no coinciden, cobra el servidor y la pantalla muestra el total final devuelto.

**Cola sin conexión del personal:** la comanda guardada sin red pasa a enviar solo artículos, cantidades, notas, petición de tapas y un identificador único. Al volver la red se llama a la misma función. Consecuencia: si el precio de carta cambia mientras no hay red, se cobra el precio vigente al sincronizar. Me parece lo correcto, pero confírmalo.

## Plan

### Base de datos (una migración)
1. Columna nueva `orders.client_request_id` (opcional, única por bar) para que un reintento no duplique la comanda.
2. Función `place_order(session_id, lines, tapa_request, client_request_id, already_served)`, que se ejecuta como un único paso de todo o nada:
   - comprueba que quien pide es miembro de la sesión o personal del bar, y que la sesión está abierta o pendiente;
   - pone `created_by_role` según el puesto real (`user_roles`), nunca según lo que envía el móvil;
   - lee de la carta nombre, precio, IVA, destino y disponibilidad, y rechaza artículos agotados, de otro bar o con cantidades no válidas;
   - calcula las tapas (Granada y Almería) y su precio;
   - «Ya servido» solo se acepta si pide el personal;
   - inserta la comanda y sus líneas, actualiza `last_activity_at` y devuelve el id y el total;
   - si ya existe ese `client_request_id`, devuelve la comanda existente.
3. Quitar el permiso de INSERT directo en `orders` y `order_items` a `anon` y `authenticated`, y borrar sus dos reglas de inserción. Los disparadores de existencias, aprobación automática e impresión siguen funcionando igual porque se disparan con la inserción que hace la función.

### App
- `m.$token.tsx`, `StaffOrderDialog.tsx` y `offline.ts`: sustituir los dos inserts por una sola llamada a `place_order`.
- No toco nada más del bloque: divisiones, cobros y facturas quedan como están.

## Qué puede romperse
- **Versiones antiguas de la app abiertas en móviles:** al quitar el INSERT directo dejarán de poder pedir hasta recargar la página. Se mitiga publicando app y base de datos a la vez.
- **Comandas ya guardadas sin red con el formato antiguo:** las convierto al sincronizar (vuelven a ser artículos y cantidades) para no perderlas.
- **Pequeñas diferencias de redondeo o de rondas entre la vista previa y el servidor:** las cubre la prueba de comparación.

## Cómo lo pruebo
1. **Antes del arreglo**, en una mesa de prueba: un cliente envía un artículo a 0 € y con `created_by_role: 'waiter'`. Debe entrar; pegaré el resultado.
2. **Después del arreglo:** el mismo intento se rechaza. También se rechaza un artículo agotado. Si fuerzo el fallo de una línea, no queda ninguna comanda vacía. Pegaré los resultados.
3. Pruebas automáticas de las reglas de tapa (vista previa contra servidor) y del reintento con el mismo identificador (una sola comanda).
4. Recorrido en el navegador: un cliente por QR pide; un camarero pide con «Ya servido»; un camarero pide sin red y sincroniza; tapas Granada y Almería. Compruebo totales, colas de cocina y barra, y existencias.
5. Al terminar, cierro la mesa de prueba y dejo los ajustes como estaban.

## Fuera de este bloque (anotado, sin tocar)
- `syncQueue` descarta las operaciones que fallan tras avisar. Lo trataré si me lo pasas como hallazgo.
