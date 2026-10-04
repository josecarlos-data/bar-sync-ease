# QR de mesa sin pedir acceso

## Qué pasa
Los QR se generan con la dirección desde la que se abre el panel. Como abres Mesas desde la vista previa del editor, el QR apunta a la dirección de vista previa, que es privada: Lovable pide iniciar sesión a cualquiera que no sea del equipo del proyecto. La app no pide nada al cliente; es la vista previa la que está protegida. La app todavía no está publicada, así que aún no tiene dirección pública.

## Qué haremos
1. **Publicar la app** (tú, con el botón Publicar) y dejarla visible para todos. Así tendrá una dirección pública, por ejemplo `bar-sync-ease.lovable.app`, o tu dominio propio si lo conectas.
2. **Dirección pública fija para los QR:** en Ajustes, nuevo campo «Dirección pública de la carta». Se rellena sola con la dirección publicada. Todos los QR, enlaces y PDFs de Mesas la usarán siempre, aunque abras el panel desde la vista previa.
3. **Aviso en Mesas:** si el QR fuera a apuntar a una dirección privada de vista previa, se muestra un aviso en rojo: «Estos QR no funcionarán con clientes. Publica la app».
4. **Revisión del cliente:** comprobar que la entrada por QR, con el apodo y la carta, funciona sin ninguna pantalla de acceso en la dirección publicada.

Los QR ya impresos con la dirección de vista previa habrá que volver a imprimirlos. El código de cada mesa no cambia, solo la dirección.

## Detalles técnicos
- Migración: `bar_settings.public_base_url text` (nullable).
- `admin.mesas.tsx`: URL del QR = `settings.public_base_url ?? window.location.origin`; aviso si el host contiene `id-preview--` o `lovableproject.com`.
- `admin.ajustes.tsx`: input con validación https y sugerencia de la URL publicada.
- La ruta `/m/$token` es pública y usa autenticación anónima del backend; sin cambios.
