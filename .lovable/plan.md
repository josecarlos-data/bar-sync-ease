# Tapa con la bebida (estilo Granada y estilo Almería)

Hoy existe el interruptor «tapa gratis con bebida» y las marcas «es bebida»/«es tapa» en cada artículo, pero no hacen nada. Se convierte en un ajuste con tres modos.

## Ajuste en Administración > Ajustes: «Tapa con la bebida»
- **Desactivado** (por defecto): todo se cobra a su precio, como ahora.
- **La pone el bar (Granada)**: cada bebida lleva su tapa incluida; el cliente no elige. La cocina la prepara por rondas (ver abajo).

## Tapas por rondas (modo Granada)
Cada mesa tiene un contador de ronda para no repetir tapas.
- En Ajustes el bar define su lista: 1.ª tapa, 2.ª, 3.ª... (p. ej. 1.ª patatas, 2.ª albóndigas, 3.ª migas). Después de la última se vuelve a empezar o se repite la última (configurable).
- Al servir bebidas, el camarero ve: «Tapas: 3 × 1.ª» ya calculado y ajustable con + / − antes de enviar (por si alguien no la quiere o el agua sí la lleva). La cocina recibe «Mesa 4 · 3 × 1.ª ronda (patatas)».
- **Qué bebidas cuentan**: cada bebida tiene «Incluye tapa». Valores de partida: cerveza, vino, tinto de verano, mosto y refrescos sí; agua, café e infusiones no. El bar lo cambia a su gusto.
- **Tapa para bebida que no la incluye**: botón «+ tapa extra» que la añade y la cobra al precio que fije el bar.
- **Ejemplo** (4 personas): 2 cervezas + Coca-Cola + agua → propone 3 × 1.ª (ajustable a 4 cobrando 1 extra). Luego 4 cervezas → 4 × 2.ª. Luego 2 mostos → 2 × 3.ª.
- **Rondas parciales** (luego 2 cervezas más): la app lleva la cuenta por "plazas": las 2 nuevas van a las personas con menos tapas, así que propone 2 × 4.ª si todos llevan 3, o lo que corresponda. El camarero puede cambiar a otra ronda con un toque si el cliente lo pide. Se escala por defecto, sin preguntar, para no frenar el servicio.
- El cliente que pide por QR ve «Incluye tapa (2.ª ronda)»; en De pie funciona igual por cuenta.

## Modo Almería: el cliente elige la tapa
Es el tercer modo del ajuste «Tapa con la bebida».
- Cada bebida que «incluye tapa» da derecho a elegir una tapa de la carta.
- Tapas normales: 0 €. Tapas especiales: solo el suplemento (1 €, 2 €...). Ejemplo: bebida 3,50 € + tapa +1 € = 4,50 €.
- Cliente (QR) y camarero ven un contador: «Tapas por elegir: 2 de 3 bebidas». En cada tapa sale «Incluida» o «+1 €».
- Si piden más tapas que bebidas, las sobrantes se cobran a precio de tapa suelta, con aviso.
- La cocina recibe el nombre de la tapa elegida (no la ronda).
- Se puede usar con bebidas de rondas anteriores: si piden la tapa después, sigue contando.

## En cada artículo
- Bebida: «Incluye tapa» (sí/no; p. ej. agua o café sin tapa).
- Tapa: «Suplemento con bebida» en euros (0 = incluida; 1 €, 2 €, 3 €...). Ejemplo: bebida 3,50 € + tapa con suplemento 1 € = 4,50 €; con suplemento 3 € = 6,50 €.
- Una tapa marcada «no se puede elegir con bebida» se cobra siempre a precio completo.

## Cómo se ve
- **Cliente (carta)**: banner «Cada bebida incluye una tapa». En tapas: «Incluida» o «+1 €». En el carrito: «Tapas disponibles: 2 de 3 bebidas». Si pide más tapas que bebidas, las sobrantes van a precio normal, con aviso.
- **Camarero (Añadir comanda / De pie)**: mismo contador y mismos precios aplicados solos.
- **Ticket**: la tapa aparece como «Tapa: Albóndigas — incluida» o «+1,00 € suplemento», con IVA correcto.

## Reglas
- El emparejamiento se hace por mesa y sobre el total de la sesión (bebidas de rondas anteriores cuentan), así sirve si piden la tapa después.
- Si hay más tapas que bebidas, se incluyen las primeras pedidas; las demás van a precio normal. El suplemento se cobra siempre.
- La cuenta dividida, el fiado y las facturas usan los precios ya aplicados.

## Detalles técnicos
- Migración: `bar_settings.tapa_mode text default 'off'` ('off'|'house'|'choice'), `house_tapa_text`; `items.includes_tapa bool default true`, `items.tapa_supplement numeric default 0`, `items.tapa_eligible bool default true`. `free_tapa_with_drink` queda marcado como obsoleto (se migra a 'house' si estaba activo).
- Helper compartido `src/lib/tapas.ts`: dado carrito + líneas existentes de la sesión, devuelve precio efectivo por línea; se usa en MenuBrowser, StaffOrderDialog y al guardar (`price_snapshot` = suplemento o precio). Modo 'house' inserta línea a 0 € destino cocina.
- Bar de prueba: dejar modo desactivado; añadir suplementos de ejemplo a 3-4 tapas especiales de la carta.
- Prueba en móvil: 2 bebidas + 1 tapa normal + 1 especial (+1 €) + 1 tapa extra a precio completo.
