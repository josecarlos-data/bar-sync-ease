# Apodo de mesa opcional y sin repeticiones

## Qué cambia
- **Ajustes → nueva opción "Pedir apodo al escanear el QR"** (Sí / No).
  - **No** (por defecto en bares que no lo quieran): el cliente escanea y entra directamente a la carta, sin pantalla de nombre.
  - **Sí**: igual que ahora, el nombre es opcional.
- **Fin del "Mesa 4, Mesa 4":** si el cliente no pone nombre, ya no se guarda "Mesa 4" como apodo; queda vacío. Así, en cocina y barra se ve y se oye solo "Mesa 4" una vez.
- **Lectura en voz y pantallas:** si el apodo coincide con el nombre de la mesa (casos antiguos ya guardados como "Mesa 4" o "Barra 2"), se omite. Solo se dice el apodo cuando aporta algo ("Mesa 4, Paco").
- Lo mismo en tickets, comandas, mesas del camarero y cuentas de barra: sin "Barra 1 · Barra 1".
- Cuentas de barra sin nombre: se muestran como "Barra 1" (sin apodo duplicado).
- El camarero puede seguir poniendo apodo al añadir una comanda si quiere, aunque la opción esté en No.

## Detalles técnicos
- Migración: `bar_settings.ask_nickname boolean NOT NULL DEFAULT true` (mantiene el comportamiento actual hasta que el admin lo cambie).
- `joinTable`: si `ask_nickname=false` o no llega apodo, crea la sesión con `nickname=null` sin pedir paso "nickname"; `m.$token.tsx` deja de rellenar `Mesa N` por defecto y salta la fase de apodo si está desactivada.
- `openCounterAccount`: `nickname` null si no se escribe; `de-pie.tsx` muestra `tableLabel(number)` como título y el apodo debajo solo si existe.
- Helper `displayNickname(nickname, number)` en `src/lib/tableLabel.ts` que devuelve null si el apodo está vacío o es igual a `tableLabel(number)`; usarlo en QueueBoard (texto y voz), comandas, camarero, historial, TableOrdersDialog, LiveTicket, ticket.ts y PrintAgent.
- `admin.ajustes.tsx`: interruptor en la sección de mesas/clientes.
