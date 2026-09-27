# Comandas desde el panel del personal

## Qué se añade
- En **Mesas** (camarero), cada mesa tiene un botón **"Añadir comanda"**, también en mesas libres.
- Se abre una carta a pantalla completa (como la del cliente): categorías, cantidades, nota por línea, agotados en gris y resumen con "Enviar comanda" y confirmación.
- Si la mesa está libre, se abre una sesión nueva (ya aceptada). Se puede poner un apodo, pero no es obligatorio.
- Si la mesa estaba pendiente de aprobar, al enviar la comanda se acepta sola (esto ya funciona así).
- La comanda llega a barra y cocina según su destino y el cliente la ve en tiempo real, marcada como "Añadida por el camarero".

## Quién puede hacerlo
- Administrador: siempre.
- Camarero: solo si el ajuste "Camarero puede añadir artículos" está activo (activo por defecto).
- Barra y cocina: también pueden, con el mismo ajuste. Tendrán un acceso a "Mesas" que solo sirve para añadir comandas.

## Detalles técnicos
- Nuevo componente `StaffOrderDialog` que reutiliza la lógica de carrito de `m.$token.tsx` (se extrae a un hook compartido `useCart`).
- Nueva server fn `openSessionForTable` (requireSupabaseAuth + is_staff_of + comprobación de `waiter_can_order`) que reutiliza la sesión pending/open o crea una `open`.
- Insert en `orders` con `created_by_role` = rol del empleado, y `order_items` con snapshots. Las políticas actuales (is_staff_of + session_is_open) ya lo permiten, sin migración.
- Se oculta el botón cuando el ajuste está desactivado y el usuario no es administrador.
- Prueba con Playwright: Camarero1 añade una comanda a una mesa libre y se comprueba que aparece en cocina.
