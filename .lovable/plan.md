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

No he lanzado un pedido manipulado contra la base real para no ensuciar los datos. Lo reproduciré dentro de una transacción que se deshace al final (ver «Cómo lo pruebo»).

## Respuesta a «Para rebatir»

**Función única con lógica en el servidor, no un disparador que filtre precios.** Un disparador que acepte «el precio de carta, 0, el suplemento o la tapa extra» sigue dejando que el cliente elija el más barato: pedir 5 platos como «incluidos» a 0 € o al suplemento aunque solo tenga 1 bebida. Para impedirlo, el disparador tendría que contar bebidas y rondas, es decir, la misma lógica, pero repartida fila a fila y peor. La función es más segura y además más fácil de mantener, porque las reglas quedan en un solo sitio.

**Cómo llevar las reglas de tapa sin duplicarlas mal:**
- El servidor manda. Calcula bebidas con tapa, el cupo de Almería, las rondas de Granada, el salto de rondas agotadas y el precio de la tapa extra.
- El móvil solo envía lo que el camarero decide de verdad: artículos, cantidades y notas. En modo Granada envía además cuántas tapas quiere poner y si fuerza una ronda nueva.
- `src/lib/tapas.ts` se queda solo para mostrar la vista previa en pantalla.
- Una prueba automática compara la vista previa con lo que devuelve el servidor en los casos ya acordados: 2 cañas + agua dan 2 primeras; 2 cañas más dan 2 segundas; 3 tapas con 2 bebidas dan 1 extra a 1,50 €; Almería con 2 bebidas da «2 de 2» y cobra el suplemento.
- Si algún día no coinciden, cobra el servidor y la pantalla muestra el total final devuelto.

**Cola sin conexión del personal:** la comanda guardada sin red pasa a enviar solo artículos, cantidades, notas, petición de tapas y un identificador único. Al volver la red se llama a la misma función. Consecuencia: si el precio de carta cambia mientras no hay red, se cobra el precio vigente al sincronizar. Confirmado por ti.

## Tus condiciones: las acepto todas
No rebato ninguna. Dos precisiones:
- **Condición 2:** si el personal pide un artículo agotado, la comanda entra y el stock puede quedar en negativo. Es lo que ya ocurre hoy y queda reflejado en Existencias. El aviso que devuelve la función nombra los artículos.
- **Condición 5:** en una comanda guardada sin red, el identificador se crea al guardarla en el móvil. Así, aunque se sincronice dos veces, solo entra una.

## Plan

### Fase A — una migración, sin quitar nada
1. Columna `orders.client_request_id uuid` (opcional) con índice único por `(session_id, client_request_id)`.
2. Función `place_order(_session_id, _request_id, _lines, _tapas, _force_new_round, _already_served)`:
   - **Seguridad:** `SECURITY DEFINER`, `SET search_path = public`. `REVOKE EXECUTE ... FROM public, anon` y `GRANT EXECUTE ... TO authenticated`. El bar sale de la sesión y el autor de `auth.uid()`. `created_by_role` sale de `user_roles`: si no tiene puesto, es `client`.
   - **Acceso:** debe ser personal del bar de la sesión o miembro de la sesión. La sesión debe estar abierta o pendiente.
   - **Identificador obligatorio:** si ya existe en esa sesión, devuelve esa comanda sin crear otra. Si existe en otra sesión, da error.
   - **Límites:** máximo 30 por línea, máximo 40 líneas por comanda, notas de hasta 200 caracteres y como mucho 30 tapas por petición. Todo lo que pase de ahí se rechaza con un mensaje claro.
   - **Carta:** nombre, precio, IVA y destino se leen de `items` del mismo bar; si un artículo es de otro bar o no existe, se rechaza. Si está agotado: al cliente se le rechaza la comanda entera con `{sold_out:[nombres]}`; al personal se le acepta y se le devuelve un aviso.
   - **Tapas:** las reglas de `tapas.ts` se trasladan a SQL. Almería: el cupo se calcula en servidor y lo que lo supera se cobra a precio de carta. Granada: el número de tapas pedido se limita a 30; las que superan las bebidas con tapa se cobran como extra a `tapa_extra_price`, nunca gratis, y se saltan las rondas agotadas. Si pide un cliente, se ignoran `_force_new_round` y `_already_served`.
   - **Todo o nada:** inserta la comanda y sus líneas en una sola operación y actualiza `last_activity_at`.
   - **Devuelve:** `{order_id, total, lines:[{name, qty, price, tapa_kind, tapa_round}], warnings:[...]}`.
3. **App:** `m.$token.tsx` (el identificador se genera al abrir la confirmación), `StaffOrderDialog.tsx` y `offline.ts` llaman a `place_order` y muestran las líneas y el total que devuelve. Las comandas guardadas sin red con el formato antiguo se convierten al nuevo al sincronizar.
4. **Deshacer la Fase A:** volver a la versión anterior de la app y borrar la función (`DROP FUNCTION place_order`). La columna nueva puede quedarse porque no molesta. Nada se ha quitado todavía, así que las versiones antiguas siguen pidiendo.

### Fase B — migración aparte, solo cuando confirmes que la app publicada funciona
- `REVOKE INSERT ON orders, order_items FROM anon, authenticated` y `DROP POLICY orders_insert`, `DROP POLICY order_items_insert`.
- **Deshacer la Fase B:** `GRANT INSERT` de nuevo y volver a crear las dos reglas con su texto literal, el que aparece en la Prueba 1.

## Qué puede romperse
- **Diferencias entre la vista previa y el servidor al calcular tapas:** las cubre la prueba de comparación. La pantalla siempre muestra lo que devuelve el servidor.
- **Comandas antiguas guardadas sin red:** se convierten al nuevo formato al sincronizar.
- **Personas que pedían más de 30 unidades de algo:** las rechazará el límite. Si te parece poco para tu bar, cambio la cifra.

## Cómo lo pruebo
1. **El ataque, sin dejar rastro:** en una sola transacción, `BEGIN`, actuar como un cliente de la mesa de prueba (`SET LOCAL role authenticated` y `request.jwt.claims`), insertar a 0 € con `created_by_role='waiter'`, leer el resultado y `ROLLBACK`. El `ROLLBACK` deshace también el stock y los movimientos que haya creado el disparador. Pegaré la salida literal antes y después de la Fase B. Si la herramienta no permite transacciones, uso un artículo sin existencias enlazadas y borro a mano la comanda de prueba; te lo diré y pegaré lo borrado.
2. **`place_order` directamente:** precio de carta aunque el móvil envíe otro; cliente con un artículo agotado (rechazo con el nombre); personal con agotado (acepta con aviso); el mismo identificador dos veces (una sola comanda); identificador de otra sesión (error); límites superados; cliente que intenta forzar ronda o «ya servido» (se ignora); fallo de una línea (no queda comanda vacía). Todo con `ROLLBACK`.
3. **Pruebas automáticas** de las reglas de tapa, comparando la vista previa con el servidor en los casos acordados.
4. **Recorrido en el navegador:** cliente por QR, camarero con «Ya servido», camarero sin red y sincronización, tapas Granada y Almería. Compruebo totales, colas y existencias, cierro la mesa de prueba y dejo los ajustes como estaban.

## Respuesta: permisos de escritura de anon (solo lista, sin arreglar)
`anon` tiene INSERT, UPDATE, DELETE y TRUNCATE en las **29 tablas** de `public`: bar_settings, bars, bill_split_assignments, bill_split_parts, bill_splits, categories, category_translations, customer_tab_invoices, customer_tab_lines, customer_tabs, invoice_counters, invoice_records, invoices, item_translations, items, order_instructions, order_items, orders, print_jobs, profiles, purchase_items, service_calls, session_members, stock_movements, stock_pools, table_sessions, tables, user_roles y waitlist_entries.

**Por qué no es explotable hoy:** solo hay 3 reglas que incluyen a `anon`, y las tres son de lectura (`item_translations`, `category_translations` e `invoice_records`). Sin una regla de escritura, la base de datos rechaza cualquier escritura de `anon`. Los clientes del QR entran con sesión anónima, que cuenta como `authenticated` y no como `anon`.

**Por qué conviene revisarlo como hallazgo aparte:** TRUNCATE no pasa por esas reglas. La API pública no lo ofrece, pero es un permiso que sobra. Probablemente viene de los permisos por defecto del esquema.

## Fuera de este bloque (anotado, sin tocar)
- `syncQueue` descarta operaciones que fallan (hallazgo aparte).
- Permisos de escritura sobrantes de `anon` (hallazgo aparte).
