# Afinar la carta virtual

## Resultado
- Mantener el índice superior que lleva a cada sección; no convertir la carta en desplegables por secciones.
- Dentro de cada subsección, mostrar inicialmente los artículos en orden alfabético, conservando la separación por grupos (por ejemplo, Cerdo, Ternera y Choto) y el orden actual de secciones y grupos.
- Añadir en Carta del administrador una opción de orden predeterminado para el cliente: **Alfabético**, **Más vendidos** o **Manual**. El orden manual seguirá ajustándose con las flechas existentes dentro de cada grupo. La opción elegida se guardará por bar y se aplicará tanto a la carta del cliente como a la carta para tomar comandas del personal; no alterará el diseño de la carta impresa.
- En “Más vendidos”, ordenar dentro de cada grupo según las unidades pedidas en los últimos 30 días, excluyendo líneas eliminadas y usando el identificador del artículo; empates y artículos sin ventas en orden alfabético. No mezclar productos de distintos grupos.
- Mostrar el desplegable de un artículo solo cuando tenga descripción o imagen que aporten detalle adicional. Los alérgenos seguirán visibles en la fila y, cuando haya detalle desplegado, podrán figurar allí también sin que sean el único motivo para mostrar la flecha.
- Retirar el control actual “Por grupo / A-Z” de la carta pública: su vista A-Z elimina la separación de grupos. El índice y el buscador permanecen.

## Detalles técnicos
- Guardar la preferencia en `bar_settings` con valor inicial `alpha`; adaptar el cálculo compartido de secciones y los dos puntos de entrada a la carta virtual, manteniendo la impresión con su orden actual.
- Obtener el recuento agregado de ventas por bar mediante una consulta segura para la carta pública, sin exponer comandas ni datos de clientes. Mantener una alternativa alfabética si no hay datos.
- Verificar en móvil y escritorio los grupos, el índice, los artículos con y sin detalles, las tres opciones de orden y que la carta impresa siga igual.
