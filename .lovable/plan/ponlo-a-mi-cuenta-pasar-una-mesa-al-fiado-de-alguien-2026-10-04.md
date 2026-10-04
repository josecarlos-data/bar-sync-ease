# «Ponlo a mi cuenta»: pasar una mesa al fiado de alguien

## Qué cambia para el camarero
En la mesa (y en las cuentas De pie) aparece un botón **«A la cuenta de…»** junto a Cobrar, solo si el fiado está activado en Ajustes.

Flujo en 2 toques:
1. Pulsa «A la cuenta de…» → se abre una lista con las cuentas de fiado abiertas, con buscador y las más usadas arriba.
2. Toca el nombre (p. ej. «Antonio») → confirmación: «Pasar 12,40 € de Mesa 4 a la cuenta de Antonio» → Aceptar.

Si la persona aún no tiene cuenta: botón «Nueva cuenta» dentro de la misma lista (solo nombre, teléfono opcional) y se carga directamente.

Resultado:
- Todo lo consumido en la mesa pasa como líneas a la cuenta de esa persona, con una nota «Mesa 4 · 04/10».
- La mesa se cierra y queda libre, sin ticket de cobro (se cobra cuando la persona pague su fiado).
- En Fiado, las líneas se ven agrupadas por mesa de origen.

## Casos cubiertos
- Mesa con cuenta dividida: se puede pasar solo una parte (un grupo) a la cuenta de alguien; el resto se cobra normal. La parte queda marcada como pagada «a fiado».
- Lo pendiente de servir se pasa igual (lo pidieron); el stock no se descuenta dos veces.
- Si la mesa ya tiene partes cobradas, solo se pasa lo pendiente.
- En el Histórico la mesa figura como «Cargada a la cuenta de Antonio».

## Detalles técnicos
- Nueva función de base de datos atómica `charge_session_to_tab(_session, _tab, _split_part default null)`: comprueba personal del bar y fiado activo, copia `order_items` no borrados (o los asignados a la parte) a `customer_tab_lines` con snapshots de precio/IVA y nota de origen, marca la parte como pagada con `payment_method='fiado'` o cierra la sesión (`closed_by`, decisión registrada).
- Añadir a `customer_tab_lines` columna opcional `source_session_id` (agrupar por mesa) y saltar el trigger de stock cuando venga de una mesa, para no descontar dos veces.
- Componente nuevo `ChargeToTabDialog` reutilizado en `camarero.tsx` (detalle de mesa y partes de división) y `de-pie.tsx`.
- Ordenar cuentas por uso reciente (últimas líneas añadidas).
- Prueba en navegador: mesa con 2 productos → cargar a cuenta existente → mesa libre y líneas en Fiado; y caso de una parte de división.
