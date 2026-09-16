# TableTap Order

Quiero desarrollar una app web (PWA, uso principal en móvil) para gestionar pedidos en bares, usando Lovable Cloud. Ahora es para un solo bar, pero diseña la base de datos multi-bar desde el inicio (todas las tablas con bar_id) para poder venderla a más bares en el futuro.

OBJETIVO

Agilizar los pedidos y asegurar la comunicación entre cliente, camarero, barra y cocina.

ROLES

- Administrador, camarero, barra y cocina: con login.

- Cliente: sin registro; entra escaneando el QR de su mesa.

PANEL ADMINISTRADOR

- Gestión de artículos: nombre, categoría, precio, imagen (subida propia o imagen de referencia según el nombre), alérgenos, disponible/agotado, destino (barra o cocina).

- Gestión de mesas: crear mesas y generar un QR único por mesa, con token no adivinable.

- Configuración por bar:

  · Mostrar u ocultar precios al cliente (por defecto se muestran).

  · Barra y cocina separadas o una sola cola.

  · El camarero puede añadir artículos a cualquier mesa (por defecto sí).

  · Tapa gratis con bebida (activar/desactivar). Si está activa, por cada bebida el cliente elige una tapa sin coste que va a cocina.

  · Pasarela de pago activable/desactivable en cualquier momento (p. ej. por temporadas).

SESIÓN DE MESA

- Al escanear el QR se abre una sesión de mesa. El primer cliente pone un apodo al grupo ("Mesa 4 - Ayuntamiento").

- Varios clientes pueden estar en la misma mesa y pedir a la vez; todos ven las comandas de la mesa en tiempo real.

- La sesión se cierra al pagar o cuando la cierra el camarero; así el QR no permite pedir fuera del bar y el apodo se reinicia.

INTERFAZ CLIENTE

- Catálogo por categorías. Los artículos disponibles se muestran arriba; los agotados van en una sección aparte, claramente diferenciada (gris, etiqueta "Agotado").

- Muestra alérgenos. Permite elegir cantidad y añadir una nota por línea ("sin cebolla").

- Resumen de la comanda abajo y botón "Enviar comanda", con un modal para confirmar o eliminar la comanda.

- Puede lanzar varias comandas.

- Botón "Llamar al camarero".

- Aviso cuando su pedido está listo.

- Vista de la cuenta con el total, con detalle agrupado por comandas y por artículos.

- El cliente NO puede eliminar líneas ya enviadas; debe avisar al camarero.

BARRA Y COCINA

- Reciben las líneas según su destino, en tiempo real y en cola por orden de llegada.

- Orden configurable: por llegada (por defecto), por mesa o por producto.

- Cada línea muestra la cantidad y la mesa (número + apodo), bien diferenciadas visualmente, además de la nota.

- Pueden marcar como listo por línea o la comanda completa.

INTERFAZ CAMARERO

- Lista de mesas con su estado (libre, con pedido, listo para servir, pide la cuenta, llamada), para cambiar de mesa rápido sin escanear.

- Añadir artículos a cualquier mesa.

- Es el único que puede eliminar líneas de comandas ya enviadas, y queda registro de quién lo hizo y cuándo.

- Marcar como servido, cobrar y cerrar la mesa.

CUENTA Y DIVISIÓN

El cliente elige una opción:

1. Pagar la cuenta completa.

2. Dividir a partes iguales: introduce el número de personas y se muestra el importe por persona.

3. Dividir por consumo: introduce el número de grupos (A, B, C…) y cada grupo selecciona sus artículos y cantidades.

   Si queda algo sin asignar, no se puede cerrar la división hasta elegir una de estas opciones: asignarlo a un grupo, repartirlo a partes iguales entre los grupos, o marcarlo como "pendiente con camarero".

Después: "Solicitar cuenta" (avisa al camarero) o, si la pasarela está activa, pagar online cada parte.

OFFLINE Y RESILIENCIA

- PWA instalable para el personal.

- Guardar en local el estado de las mesas abiertas y sus cuentas, para poder consultarlas y cobrar aunque se caiga la conexión.

- Guardar en local los pedidos creados sin conexión y sincronizarlos al volver la red.

- Indicador visible de conexión y sincronización.

FASES

- Fase 1: admin (artículos, mesas, QR), sesión de mesa, pedido del cliente, pantallas de barra y cocina en tiempo real, vista de la cuenta.

- Fase 2: interfaz del camarero, división de la cuenta, tapa con bebida, avisos.

- Fase 3: pasarela de pago y offline completo.

Empieza proponiendo el modelo de datos y el plan de la fase 1.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5388489f-3876-4c20-b90a-e44e222eb870).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
