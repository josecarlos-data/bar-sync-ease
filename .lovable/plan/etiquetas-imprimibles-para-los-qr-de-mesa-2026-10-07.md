# Etiquetas imprimibles para los QR de mesa

## Resultado
Cada mesa tendrá una etiqueta vertical de **60 × 90 mm**, preparada para imprimir y pegar, en lugar de descargar únicamente el QR.

## Etiqueta individual
- Cabecera con **solo el número de mesa**, grande y centrado.
- QR centrado, generado con **corrección de errores H** y zona silenciosa blanca completa.
- Sobre el centro del QR, círculo blanco con borde y el número de mesa.
- El círculo nunca superará el **20 % del ancho del QR**; el texto se ajustará automáticamente para números de varias cifras sin agrandarlo.
- Debajo: **«Escanea para pedir»**.
- Abajo a la derecha: **«by JCSR»**, pequeño y gris claro.
- Acciones por mesa: **Descargar PNG** en alta resolución y **Descargar PDF** a tamaño físico exacto.

## PDF de todas las mesas
- Botón **«Descargar todas en PDF»** en la cabecera de Mesas y QR.
- Incluirá **todas las mesas**, también las desactivadas, respetando el orden numérico.
- Hoja A4 con **9 etiquetas por página** (3 × 3), cada una de 60 × 90 mm.
- Márgenes equilibrados y líneas de corte finas alrededor de cada etiqueta.
- Añadirá páginas automáticamente cuando haya más de nueve mesas.

## Comprobaciones
- Extraer la composición a un generador compartido para que la vista previa, PNG y ambos PDF sean idénticos.
- Comprobar con un lector de QR que una etiqueta real generada sigue resolviendo exactamente la dirección de su mesa, tanto a resolución de descarga como simulando el tamaño impreso.
- Probar números de una y varias cifras para confirmar que el círculo y el texto respetan el límite del 20 %.
- Verificar visualmente una etiqueta y todas las páginas del PDF A4: márgenes, cortes, alineación y ausencia de texto recortado.
- Mantener el aviso actual cuando la dirección configurada sea privada y no alterar los códigos ni enlaces ya asignados a las mesas.

## Detalles técnicos
- Renderizado en Canvas de alta resolución para el PNG; QR con `errorCorrectionLevel: "H"` y margen de cuatro módulos.
- PDF con jsPDF: página individual de 60 × 90 mm y lote A4 de 210 × 297 mm.
- La pantalla seguirá generando las etiquetas en el navegador; no requiere cambios en datos ni en los QR existentes.
- Completar los metadatos sociales propios de la página de Mesas y QR al modificarla.
