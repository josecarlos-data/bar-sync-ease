# Auditoría completa de la app de comandas

Objetivo: comprobar que todo funciona de punta a punta, detectar fallos y corregirlos. Al final recibirás un informe claro: qué funciona, qué se ha arreglado y qué queda pendiente.

## 1. Seguridad y datos
- Escaneo de seguridad y revisión de permisos de la base de datos (que un cliente no vea pedidos de otras mesas ni de otros bares, que cada rol solo haga lo suyo).
- Comprobar que los códigos QR no son adivinables y que una mesa cerrada no admite pedidos.
- Revisar que el pago con tarjeta solo marque como cobrada la parte correcta y nunca dos veces.

## 2. Recorridos por rol (en móvil, con el bar de pruebas)
- **Cliente QR**: escanear, apodo, carta con alérgenos, añadir con notas, enviar, no poder borrar lo enviado, llamar camarero, pedir cuenta, dividir y pagar con tarjeta, idiomas.
- **Camarero**: Mesas, aprobar sesiones, añadir comanda, De pie, cobrar, fiado («A la cuenta de…»), Bizum, lista de espera.
- **Cocina y barra**: colas en tiempo real, marcar en preparación/listo, lectura en voz, tapas por rondas (Granada) y a elegir (Almería).
- **Admin**: artículos, mesas y QR, personal, ajustes (cada opción nueva apagada por defecto), carta imprimible, existencias, historial y tickets.
- **Sin conexión**: encolar y sincronizar.

## 3. Calidad técnica
- Revisión de errores de compilación, consola y servidor durante las pruebas.
- Cálculos: IVA del ticket, división de cuentas, suplementos y tapas extra, descuento de existencias sin duplicar.
- Títulos y descripciones de cada página.

## 4. Correcciones
- Arreglar los fallos que aparezcan, empezando por el ya conocido: los nombres y descripciones de platos no se traducen en la carta del cliente, y falta el botón «Traducir con IA».
- Volver a probar cada arreglo.

## 5. Informe final
Lista de lo comprobado (OK / arreglado / pendiente con motivo).

## Detalles técnicos
- Herramientas: escaneo de seguridad y linter de la base de datos, Playwright a 411px con sesiones de cada rol, consultas de verificación en la BD, logs de build/consola/servidor.
- Traducciones: corregir la carga de item_translations/category_translations en m.$token.tsx; server fn translateMenu (AI Gateway) con upsert, solo admin.
- No se cambian ajustes del bar de pruebas salvo lo necesario para probar; se restauran al terminar.
