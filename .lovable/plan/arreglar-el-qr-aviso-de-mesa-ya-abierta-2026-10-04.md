# Arreglar el QR + aviso de "mesa ya abierta"

## 1. Por qué falla el QR
El mensaje "No se pudo abrir la mesa. Vuelve a escanear el QR" sale **antes** de mirar la mesa. Aparece cuando falla la entrada del cliente como invitado, sin registro. Por eso sale igual en todas las mesas. Lo más probable es que la entrada de invitados se desactivara al tocar los ajustes de contraseñas, el día que creamos las cuentas de prueba.

Arreglo:
- Comprobar ese ajuste y volver a activar la entrada de invitados. El cliente sigue sin tener que registrarse.
- Cambiar el mensaje genérico por uno más útil para el cliente ("No hemos podido conectar, inténtalo de nuevo") con botón **Reintentar**, y guardar el motivo real en el registro para poder verlo.
- Probarlo escaneando una mesa en el navegador de pruebas y en la app publicada.

## 2. Aviso "Mesa ya abierta"
Cuando un móvil nuevo escanea una mesa que ya tiene una sesión abierta por otro cliente, verá:

```text
Esta mesa ya está abierta
Abierta por "Apodo" a las 17:42 · 3 comandas
[ Somos del mismo grupo, unirme ]
[ No, somos otros clientes ]
```

- **Unirme**: entra a la mesa como ahora y pide junto a sus compañeros.
- **Otros clientes**: aparece "Mesa abierta. Avisa al camarero". Además se manda una llamada automática al camarero ("Mesa X: nuevos clientes con la mesa sin cerrar"). El camarero cierra la mesa anterior y los nuevos clientes vuelven a escanear.
- Quien ya estaba dentro de la mesa no ve este aviso al recargar.

## Detalles técnicos
- `m.$token.tsx`: mostrar el error real de `signInAnonymously`, añadir un botón para reintentar y dejar el error en la consola.
- Comprobar y activar las sesiones anónimas con `supabase--configure_auth`.
- `joinTable`: si existe una sesión pending/open y el usuario no está en `session_members`, devolver `{ alreadyOpen: { nickname, opened_at, orderCount } }` salvo que llegue `confirmJoin: true`. Nueva acción `reportOccupied` que inserta un `service_calls` de tipo `waiter` en esa sesión.
- Sin cambios en la base de datos.
