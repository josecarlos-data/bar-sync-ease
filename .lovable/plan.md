# Apodo opcional al escanear el QR

## Objetivo
Que el cliente pueda entrar a pedir sin escribir nada: si no pone apodo, se usa el nombre de la mesa ("Mesa 1").

## Cambios (una sola pantalla: la de bienvenida del cliente)

1. **El campo deja de ser obligatorio.**
   - El botón "Entrar" siempre está activo, esté el campo vacío o no.
   - Si el cliente escribe un nombre, se usa ese.
   - Si lo deja vacío, se entra directamente con el apodo automático "Mesa N" (el número de la mesa escaneada).

2. **Texto más claro en pantalla.**
   - El texto explicativo pasa a decir que es opcional: "Si queréis, poned un nombre para que el camarero os identifique. Si no, entraréis como «Mesa N»."
   - El campo mantiene el ejemplo como sugerencia.

3. **Sin cambios en la base de datos ni en el resto de la app.**
   - El apodo ya era opcional en el servidor; solo lo exigía esta pantalla.
   - El camarero, barra y cocina seguirán viendo "Mesa 1" o el nombre que el grupo haya puesto, igual que hasta ahora.

## Detalles técnicos
- Archivo: `src/routes/m.$token.tsx` (fase "nickname").
- El botón llama a `attempt(nickname.trim() || `Mesa ${tableInfo.number}`)`.
- `joinTable` ya acepta apodo opcional; no hace falta tocarlo.
- Verificación: compilar y probar en el navegador de pruebas entrando a una mesa sin escribir nombre y comprobando que entra como "Mesa 1".
