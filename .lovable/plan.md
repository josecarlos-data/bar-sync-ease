# Altas de personal desde dentro de la app

## Antes de nada: no se ha borrado nada

He revisado los datos. Sigue todo: la carta (10 artículos, 4 categorías), las 7 mesas y las sesiones. Tu cuenta original "Bar Laroya" sigue siendo administradora.

Lo que pasó es que la cuenta nueva que creaste desde la pantalla de acceso entró como **camarero** (la primera cuenta del bar es la administradora; las siguientes, camarero). Al entrar con ella ves menos opciones, y por eso parece que falta contenido. Entrando con la cuenta original vuelves a verlo todo.

## 1. Se quita el registro público

En la pantalla de acceso desaparece "No tengo cuenta" / crear cuenta. Solo queda entrar. Nadie puede darse de alta desde fuera.

## 2. Acceso con usuario o con correo

El mismo campo acepta las dos cosas:

- Tu cuenta actual sigue entrando con su correo, sin cambios.
- El personal nuevo entra con un nombre de usuario tipo `Mendoza1`, `MendozaCo1`, sin correo.

## 3. Crear personal desde Personal (solo administrador)

Nuevo formulario en el panel Personal:

- Nombre de la persona (ej. "María, barra")
- Nombre de usuario (ej. `Mendoza1`) — único dentro del bar, sin espacios
- Contraseña inicial, que pone el administrador
- Roles: administrador / camarero / barra / cocina

Al guardar, la cuenta queda creada y asociada automáticamente a tu bar. Nada de correos de confirmación.

Sobre cada usuario el administrador puede además:

- Cambiar su contraseña
- Cambiar sus roles (como ahora)
- **Desactivar** el acceso (la cuenta queda bloqueada pero se conserva el histórico)
- **Borrar** la cuenta, con confirmación

Un administrador no puede desactivarse ni borrarse a sí mismo, y el bar no se puede quedar sin ningún administrador activo.

## Detalles técnicos

Base de datos (migración, solo añade):

- `profiles`: `username text`, `is_active boolean not null default true`. Índice único `lower(username)` por `bar_id`.
- Política de lectura de `profiles` ya cubre al personal del bar vía `is_staff_of(bar_id)`; se añade escritura solo para `is_admin_of(bar_id)` sobre `is_active`.

Servidor (`src/lib/staff.functions.ts`, todas con `requireSupabaseAuth` y comprobación `is_admin_of` del bar del llamante antes de tocar nada; `supabaseAdmin` importado dentro del handler):

- `createStaffUser`: valida usuario (`^[A-Za-z0-9._-]{3,32}$`) y unicidad, crea el usuario con `auth.admin.createUser({ email: "<usuario>@<slug-bar>.staff.local", email_confirm: true })`, inserta `profiles` (bar_id, full_name, username, is_active) y las filas de `user_roles`.
- `setStaffPassword`, `setStaffActive` (`auth.admin.updateUserById` con `ban_duration`), `deleteStaffUser` (`auth.admin.deleteUser`, previa comprobación de que queda otro admin activo).
- `resolveLogin` (pública, sin auth): recibe el texto introducido; si no contiene `@`, busca `profiles.username` con el cliente admin y devuelve solo el correo interno a usar. No filtra nada más.

Frontend:

- `src/routes/auth.tsx`: se elimina el modo signup y `ensureStaffProfile` deja de crear cuentas nuevas; el campo pasa a "Usuario o correo" y llama a `resolveLogin` antes de `signInWithPassword`. Si la cuenta está desactivada, mensaje claro.
- `src/routes/_authenticated/admin.personal.tsx`: formulario de alta, listado con usuario, estado activo/desactivado y acciones (contraseña, activar/desactivar, borrar) además de los roles actuales.
