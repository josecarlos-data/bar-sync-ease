# Plantillas legales para el pie del ticket + botón Guardar

## Qué verá el usuario

### 1. Pie del ticket con 3 modos (Ajustes → Datos del negocio)
Un selector encima del campo "Texto al pie del ticket":

- **Legal mínimo** — solo lo que conviene que figure en el pie según la normativa española de hostelería:
  `IVA incluido. Existen hojas de reclamaciones a disposición del cliente.`
- **Recomendado** — lo anterior más un mensaje amable y aclaraciones útiles:
  `IVA incluido. Existen hojas de reclamaciones a disposición del cliente. Este documento es una factura simplificada; si necesita factura completa con sus datos, solicítela al personal. ¡Gracias por su visita!`
- **Libre** — el campo vacío o con lo que el bar escriba.

Al elegir una plantilla, el texto se rellena en el campo y **se puede editar después** (si se edita, el selector pasa a "Libre"). Debajo, una nota corta: "Orientativo, no sustituye el asesoramiento de tu gestoría. Revisa la normativa de tu comunidad autónoma."

### 2. Aviso de datos obligatorios
Una lista pequeña con marcas verde/ámbar que dice qué falta para que el ticket sea válido como factura simplificada: razón social, NIF, dirección. (Número, fecha, desglose de IVA y "IVA incluido" ya los pone la app sola.) Nota informativa sobre VERI*FACTU: código QR y leyenda obligatorios en el futuro, queda como fase aparte.

### 3. Guardado: automático + botón "Guardar"
- Se mantiene el guardado automático al salir de cada campo.
- Se añade un botón **Guardar** fijo abajo en la sección de Datos del negocio (y en los demás bloques con campos de texto de Ajustes) que guarda todo lo escrito de golpe, y un indicador "Guardado ✓ / Cambios sin guardar".
- Si intentas salir de la página con cambios sin guardar, se guardan antes.

## Detalles técnicos
- Sin cambios en base de datos: las plantillas son constantes en `src/lib/ticket-templates.ts`; el modo se deduce comparando `ticket_footer` con las plantillas.
- `admin.ajustes.tsx`: estado local de borrador para los campos de texto del negocio y `public_base_url`; `onBlur` sigue llamando `update`; botón Guardar llama a `update` con todos los cambios pendientes; `beforeunload`/desmontaje guarda pendientes.
- Antes de construir, verificar con una búsqueda actualizada la redacción de hojas de reclamaciones y las fechas vigentes de VERI*FACTU para ajustar el texto de la nota.
