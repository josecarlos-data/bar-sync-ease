# Tapa con la bebida (estilo Granada y estilo Almería)

Hoy existe el interruptor «tapa gratis con bebida» y las marcas «es bebida»/«es tapa» en cada artículo, pero no hacen nada. Se convierte en un ajuste con tres modos.

## Ajuste en Administración > Ajustes: «Tapa con la bebida»
- **Desactivado** (por defecto): todo se cobra a su precio, como ahora.
- **La pone el bar (Granada)**: cada bebida lleva su tapa incluida; el cliente no elige. Al pedir bebida, aparece en Cocina una línea «Tapa de la casa» (precio 0) para que no se olvide. Opcional: texto de la tapa del día.
- **La elige el cliente (Almería)**: cada bebida da derecho a una tapa a elegir. Las tapas normales salen a 0 €; las especiales cobran solo su suplemento.

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
