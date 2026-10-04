# Siete mejoras para un bar de pueblo, todas opcionales

## Objetivo

Añadir a la app las funciones que le faltan para un bar pequeño de 500-100 habitantes con turismo puntual: **fiado**, **Bizum**, **carta en varios idiomas**, **funcionar sin internet**, **lista de espera**, **horario y especial del día**, y **lista de compra semanal**.

Ninguna se cuela por defecto: cada una se enciende o apaga desde Administración → Ajustes, así cada bar activa solo lo que necesita en cada momento.

## Cómo se configura (lo transversal)

En Ajustes se añade una sección nueva, **"Funciones"**, con un interruptor por mejora y una frase de una línea que dice qué va a cambiar para el cliente y para el equipo:

| Interruptor | Qué activa |
|---|---|
| Cuentas de fiado | Pantalla "Fiado" y pasar cuentas por nombre |
| Bizum | Número de Bizum en el ticket y opción de marcar "cobrado por Bizum" |
| Varios idiomas | Selector de idioma en la carta del cliente |
| Sin conexión | La app sigue abriendo y tomando comandas sin internet |
| Lista de espera | "Apuntarme" cuando la mesa está ocupada y panel de espera |
| Horario y especial | Aviso de "cerrado" y tarjeta "Especial de hoy" |
| "Hoy no hay" | Lista de agotados visible para el cliente |
| Lista de compra | Panel de consumo y lista de compra semanal |

Todos empiezan apagados (el bar de prueba los deja igual que hoy) y solo aparece en el menú lateral lo que esté activado.

## Fase A — lo típico de pueblo (primero)

### 1. Fiado / cuentas por nombre
- El camarero abre una cuenta con un nombre ("Antonio el del taller", "los de la obra") sin dar de alta a nadie.
- Apunta líneas (bebida, tapa, con nota) y las va sumando; se descuentan existencias igual que una comanda normal.
- Al "pasar la cuenta" se genera un ticket con IVA desglosado, numeración propia (serie FIA) y se marca cobrado con fecha y forma de pago.
- Histórico de cuentas abiertas y cerradas, con búsqueda por nombre.

### 2. Bizum y cobro fácil
- Ajustes guarda el número de Bizum y el titular; el ticket (provisional, final y el que ve el cliente) lo imprime con el importe al lado.
- Al cobrar una parte o cerrar mesa se elige forma de pago: efectivo, tarjeta o Bizum.
- Sin cobro automático: el camarero confirma que le ha llegado. Es un aviso, no un cargo.

### 3. Horario, especial del día y "hoy no hay"
- Editor de horario por días (abre/cierra o cerrado) con avisos de "cerrado ahora" y "abre hoy a las 20:00" en la pantalla del cliente.
- "Especial de hoy": texto libre o artículo de la carta, con su precio y foto, en la cabecera de la carta.
- "Hoy no hay": los agotados dejan de ocultarse y salen como una lista discreta arriba, para que nadie pregunte lo que ya no queda.

### 4. Lista de espera
- Cuando alguien escanea una mesa ocupada, además de "avisar a la camarera" puede apuntarse con nombre, personas y teléfono.
- El equipo ve la cola con el tiempo esperando y botones Llamar / Sentar / Quitar, con sonido al entrar alguien.
- También hay una página pública para apuntarse sin QR, para quien está en la puerta.

## Fase B — turismo

### 5. Carta en varios idiomas
- El bar elige qué idiomas tiene (español siempre, más inglés, francés, alemán…).
- Cada artículo y categoría guarda su nombre y descripción traducidos; botón "Traducir con IA" para rellenarlos de golpe y revisarlos.
- El cliente ve banderitas arriba; entra en el idioma de su móvil y puede cambiarlo. Se recuerda en su teléfono.
- Los alérgenos mantienen su nombre oficial y se traducen las etiquetas de la interfaz.

## Fase C — operativa del día a día

### 6. Lista de compra semanal
- Panel de consumo: qué se ha gastado en 7/14/30 días, media diaria, lo que queda y para cuántos días da.
- Sugerencia de pedido por artículo, con "copiar lista" para pegarla en WhatsApp o imprimirla.
- Sirve también como el panel de consumo que quedó pendiente para aprovisionamiento.

### 7. Funcionar sin internet
- La app abre y muestra la última carta y cola aunque no haya cobertura, con aviso claro de "sin conexión".
- Las comandas que se toman sin conexión se guardan en el propio dispositivo y se solas al recuperar señal, con un contador de pendientes.
- Limitación honesta: sin conexión no hay tiempo real ni pedidos del cliente; es red para el equipo, no un modo paralelo.

## Qué verá cada persona

- **Cliente:** carta en su idioma, especial del día, aviso de horario y de agotados, número de Bizum en su ticket y poder apuntarse a la espera.
- **Camarero:** fiado, cola de espera, forma de pago al cobrar y lista de compra si es el dueño.
- **Cocina y barra:** sin cambios salvo las comandas de fiado y las bebidas que ya servidas.
- **Admin:** la sección "Funciones" para encender o apagar todo.

## Detalle técnico

**Migraciones (aditivas, sin tocar datos):**
1. `bar_settings`: `tabs_enabled`, `bizum_enabled`, `bizum_phone`, `bizum_label`, `menu_languages text[]`, `menu_default_language`, `offline_mode`, `waitlist_enabled`, `hours_enabled`, `hours jsonb`, `timezone`, `special_enabled`, `special_text`, `special_item_id`, `show_sold_out_notice`, `purchase_list_enabled` — todas con default para no romper filas existentes.
2. `customer_tabs`, `customer_tab_lines`, `customer_tab_invoices` (snapshot + serie FIA desde `invoice_counters`), `bill_split_parts.payment_method`, `customer_tabs.paid_method`, RPC `next_invoice_number(bar, series)` y `close_customer_tab(tab, method)` como `security definer`; RLS con `is_staff_of`.
3. `waitlist_entries` (nombre, teléfono, personas, estado waiting/called/seated/cancelled, tiempos) con RLS de personal y alta anónima limitada.
4. `item_translations` y `category_translations` (clave primaria compuesta por id e idioma).

**Código nuevo:** rutas `/fiado`, `/espera` (pública) y `/compras`; helper `src/lib/tab.ts` (totales e IVA), `src/lib/i18n.ts` (diccionario es/en/fr/de), `src/lib/offline.ts` (outbox); agente de impresión reutilizado para tickets de fiado; `public/sw.js` con caché de la carcasa de la app y registro en `__root.tsx` solo si `offline_mode`.

**Ajustes y navegación:** `admin.ajustes.tsx` gana la sección "Funciones" y los editores de horario, idiomas y Bizum; `StaffShell.tsx` filtra `NAV` según los interruptores activos.

**Verificación:** cada fase se comprueba en el navegador con la mesa y el móvil de prueba, se revisan los registros en la base de datos y se deja el bar de prueba con las funciones apagadas al terminar.

## Orden de trabajo

Fase A (fiado, Bizum, horario/especial, espera) → Fase B (idiomas) → Fase C (compra, sin conexión). Cada fase se entrega funcionando y probada antes de empezar la siguiente.
