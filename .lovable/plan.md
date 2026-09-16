# Bar Orders — Modelo de datos y Fase 1

App web móvil (PWA) para pedidos en bares, con Lovable Cloud como backend. Base multi-bar desde el inicio: **todas las tablas llevan `bar_id`**.

## Roles

- **Administrador, camarero, barra, cocina**: entran con email y contraseña.
- **Cliente**: sin registro, entra escaneando el QR de su mesa (token largo no adivinable).

## Modelo de datos

```text
bars                 id, name, slug, created_at
bar_settings         bar_id, show_prices(true), split_bar_kitchen(true),
                     waiter_can_order(true), free_tapa_with_drink(false),
                     payments_enabled(false), queue_sort('arrival')
profiles             id(=usuario), bar_id, full_name
user_roles           id, bar_id, user_id, role(admin|waiter|bar|kitchen)
categories           id, bar_id, name, position
items                id, bar_id, category_id, name, price, image_url,
                     allergens[], available, destination(bar|kitchen), is_tapa
tables               id, bar_id, number, name, qr_token(único), active
table_sessions       id, bar_id, table_id, nickname, status(open|closed),
                     opened_at, closed_at, closed_by
orders (comandas)    id, bar_id, session_id, created_at, created_by_role,
                     client_tag
order_items (líneas) id, bar_id, order_id, item_id, name_snapshot,
                     price_snapshot, qty, note, destination,
                     status(pending|ready|served), ready_at, served_at,
                     deleted_at, deleted_by
service_calls        id, bar_id, session_id, type(waiter|bill), status, created_at
```

Notas:
- Precio y nombre se copian en la línea (`_snapshot`) para que la cuenta no cambie si luego se edita el artículo.
- Las líneas no se borran físicamente: se marcan con `deleted_at` + `deleted_by` (registro de quién y cuándo).
- Fase 2 añadirá `bill_splits` / `split_groups`; el modelo ya lo admite sin cambios.

## Seguridad de accesos

- Personal: acceso a los datos de **su** bar según su rol (roles en tabla aparte, nunca en el perfil).
- Cliente: sólo puede leer y escribir en la sesión de mesa abierta cuyo token de QR posee; no ve datos de otras mesas ni del panel.

## Fase 1 — qué se construye

**Panel administrador**
- Artículos: crear/editar con nombre, categoría, precio, imagen (subida propia), alérgenos, disponible/agotado, destino barra o cocina.
- Categorías con orden.
- Mesas: crear mesa, generar QR único descargable/imprimible por mesa.
- Configuración del bar: mostrar precios, barra/cocina juntas o separadas, camarero puede pedir, tapa con bebida, pasarela (interruptores; los dos últimos se usan en fases 2 y 3).

**Sesión de mesa (cliente)**
- Al escanear: si no hay sesión abierta, se pide apodo del grupo ("Mesa 4 - Ayuntamiento"); si ya hay, se une a ella.
- Varios clientes a la vez en la misma mesa, viendo todos las mismas comandas en tiempo real.
- La sesión se cierra al cobrar o cuando la cierra el camarero; el apodo se reinicia.

**Interfaz cliente**
- Catálogo por categorías; disponibles arriba, agotados en bloque aparte en gris con etiqueta "Agotado" (no seleccionables).
- Alérgenos visibles, cantidad y nota por línea.
- Resumen abajo + "Enviar comanda" con modal de confirmación (confirmar o vaciar).
- Varias comandas por sesión; no puede eliminar líneas ya enviadas.
- Botón "Llamar al camarero".
- Aviso cuando su pedido está listo.
- Vista de cuenta: total, agrupado por comandas y por artículos.

**Barra y cocina**
- Pantallas en tiempo real con las líneas de su destino (o una sola cola si está configurado así).
- Orden por llegada (defecto), por mesa o por producto.
- Cada línea: cantidad grande, mesa (número + apodo) destacada, nota visible.
- Marcar listo por línea o comanda completa.

**Base técnica**
- PWA instalable (Fase 1 sólo instalación; offline completo en Fase 3).
- Tiempo real en pantallas de barra, cocina y cliente.

## Fuera de Fase 1

Interfaz de camarero, división de cuenta, tapa gratis con bebida, avisos push (Fase 2); pagos online y offline completo (Fase 3).

## Detalles técnicos

- Lovable Cloud (Postgres + auth + storage + realtime), RLS en todas las tablas, rol resuelto por función de seguridad.
- `qr_token`: aleatorio de 32 caracteres, ruta pública `/m/$token`.
- Realtime por canal de bar/sesión para comandas y líneas.
- Imágenes de artículos en almacenamiento del bar, con miniatura.
- Rutas: `/` (acceso personal), `/m/$token` (cliente), `/admin/*`, `/bar`, `/cocina`.

## Antes de construir

Al aprobar, propondré 3 direcciones visuales para elegir el estilo de la app.
