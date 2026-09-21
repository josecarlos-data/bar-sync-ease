import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

type AppRole = "admin" | "waiter" | "bar" | "kitchen";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Devuelve el bar del usuario si es administrador; si no, null. */
async function adminBarId(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("user_roles")
    .select("bar_id, role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return data?.bar_id ?? null;
}

function internalEmail(username: string, slug: string) {
  return `${username.toLowerCase()}@${slug}.staff.local`;
}

/** Traduce un nombre de usuario al correo interno para iniciar sesión. */
export const resolveLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { login: string }) => data)
  .handler(async ({ data }) => {
    const login = (data.login ?? "").trim();
    if (!login) return { email: null as string | null };
    if (login.includes("@")) return { email: login };

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id, is_active")
      .ilike("username", login)
      .maybeSingle();

    if (!profile) return { email: null };
    if (profile.is_active === false) return { email: null, inactive: true as const };

    const { data: user } = await db.auth.admin.getUserById(profile.id);
    return { email: user?.user?.email ?? null };
  });

/** Crea una cuenta de personal con nombre de usuario y contraseña. */
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { username: string; password: string; fullName: string; roles: AppRole[] }) => data,
  )
  .handler(async ({ data, context }) => {
    const barId = await adminBarId(context.userId);
    if (!barId) return { error: "Solo un administrador puede crear cuentas." };

    const username = (data.username ?? "").trim();
    if (!USERNAME_RE.test(username)) {
      return { error: "El usuario debe tener entre 3 y 32 letras, números, punto, guion o guion bajo." };
    }
    if ((data.password ?? "").length < 6) {
      return { error: "La contraseña debe tener al menos 6 caracteres." };
    }
    if (!data.roles?.length) return { error: "Elige al menos un rol." };

    const db = await admin();
    const { data: existing } = await db
      .from("profiles")
      .select("id")
      .eq("bar_id", barId)
      .ilike("username", username)
      .maybeSingle();
    if (existing) return { error: "Ese nombre de usuario ya existe." };

    const { data: bar } = await db.from("bars").select("slug").eq("id", barId).maybeSingle();
    const email = internalEmail(username, bar?.slug ?? "bar");

    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      return { error: "No se pudo crear la cuenta. Prueba con otro nombre de usuario." };
    }

    const userId = created.user.id;
    await db.from("profiles").upsert({
      id: userId,
      bar_id: barId,
      full_name: (data.fullName ?? "").trim() || username,
      username,
      is_active: true,
    });
    await db
      .from("user_roles")
      .insert(data.roles.map((role) => ({ bar_id: barId, user_id: userId, role })));

    return { ok: true as const };
  });

/** Cambia la contraseña de un miembro del personal. */
export const setStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; password: string }) => data)
  .handler(async ({ data, context }) => {
    const barId = await adminBarId(context.userId);
    if (!barId) return { error: "Solo un administrador puede hacer esto." };
    if ((data.password ?? "").length < 6) {
      return { error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .eq("bar_id", barId)
      .maybeSingle();
    if (!profile) return { error: "Esa cuenta no es de tu bar." };

    const { error } = await db.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) return { error: "No se pudo cambiar la contraseña." };
    return { ok: true as const };
  });

/** Activa o desactiva el acceso de un miembro del personal. */
export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    const barId = await adminBarId(context.userId);
    if (!barId) return { error: "Solo un administrador puede hacer esto." };
    if (data.userId === context.userId) return { error: "No puedes desactivar tu propia cuenta." };

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .eq("bar_id", barId)
      .maybeSingle();
    if (!profile) return { error: "Esa cuenta no es de tu bar." };

    if (!data.active && !(await hasAnotherActiveAdmin(barId, data.userId))) {
      return { error: "El bar debe tener al menos un administrador activo." };
    }

    await db.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    await db.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    return { ok: true as const };
  });

/** Borra definitivamente una cuenta de personal. */
export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const barId = await adminBarId(context.userId);
    if (!barId) return { error: "Solo un administrador puede hacer esto." };
    if (data.userId === context.userId) return { error: "No puedes borrar tu propia cuenta." };

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .eq("bar_id", barId)
      .maybeSingle();
    if (!profile) return { error: "Esa cuenta no es de tu bar." };

    if (!(await hasAnotherActiveAdmin(barId, data.userId))) {
      return { error: "El bar debe tener al menos un administrador activo." };
    }

    await db.from("user_roles").delete().eq("user_id", data.userId).eq("bar_id", barId);
    await db.from("profiles").delete().eq("id", data.userId);
    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) return { error: "No se pudo borrar la cuenta." };
    return { ok: true as const };
  });

async function hasAnotherActiveAdmin(barId: string, excludeUserId: string) {
  const db = await admin();
  const { data: admins } = await db
    .from("user_roles")
    .select("user_id")
    .eq("bar_id", barId)
    .eq("role", "admin");
  const others = (admins ?? []).map((a) => a.user_id).filter((id) => id !== excludeUserId);
  if (others.length === 0) return false;
  const { data: active } = await db
    .from("profiles")
    .select("id")
    .in("id", others)
    .eq("is_active", true);
  return (active ?? []).length > 0;
}
