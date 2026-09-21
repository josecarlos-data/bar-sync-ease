import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_BAR = "11111111-1111-1111-1111-111111111111";

/**
 * Valida el token del QR, cierra sesiones caducadas y vincula al usuario
 * anónimo con la sesión de la mesa.
 */
export const joinTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string; nickname?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: table } = await supabaseAdmin
      .from("tables")
      .select("id, bar_id, number, name, active")
      .eq("qr_token", data.token)
      .maybeSingle();

    if (!table || !table.active) {
      return { error: "Este código QR no es válido." as const };
    }

    const { data: settings } = await supabaseAdmin
      .from("bar_settings")
      .select("require_session_approval, auto_close_hours")
      .eq("bar_id", table.bar_id)
      .maybeSingle();

    const autoCloseHours = settings?.auto_close_hours ?? 4;
    const cutoff = new Date(Date.now() - autoCloseHours * 3600 * 1000).toISOString();
    await supabaseAdmin
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("bar_id", table.bar_id)
      .neq("status", "closed")
      .lt("last_activity_at", cutoff);

    const { data: existing } = await supabaseAdmin
      .from("table_sessions")
      .select("id, nickname, status")
      .eq("table_id", table.id)
      .in("status", ["pending", "open"])
      .maybeSingle();

    let session = existing;

    if (!session) {
      const nickname = (data.nickname ?? "").trim();
      if (!nickname) {
        return {
          needsNickname: true as const,
          table: { number: table.number, name: table.name },
        };
      }
      const { data: created, error } = await supabaseAdmin
        .from("table_sessions")
        .insert({
          bar_id: table.bar_id,
          table_id: table.id,
          nickname,
          status: settings?.require_session_approval ? "pending" : "open",
        })
        .select("id, nickname, status")
        .single();
      if (error || !created) return { error: "No se pudo abrir la mesa." as const };
      session = created;
    }

    await supabaseAdmin
      .from("session_members")
      .upsert(
        { bar_id: table.bar_id, session_id: session.id, user_id: context.userId },
        { onConflict: "session_id,user_id" },
      );

    await supabaseAdmin
      .from("table_sessions")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", session.id);

    return {
      sessionId: session.id,
      barId: table.bar_id,
      status: session.status as "pending" | "open",
      nickname: session.nickname,
      table: { number: table.number, name: table.name },
    };
  });

/**
 * Devuelve el bar y los roles del miembro del personal.
 * Ya no crea cuentas ni asigna roles: las altas se hacen desde el panel Personal.
 * Excepción: si el bar aún no tiene ningún administrador, la cuenta pasa a serlo.
 */
export const ensureStaffProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName?: string }) => data)
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, bar_id")
      .eq("id", context.userId)
      .maybeSingle();

    const barId = profile?.bar_id ?? DEFAULT_BAR;

    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("bar_id", barId);

    if (!myRoles || myRoles.length === 0) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("bar_id", barId)
        .eq("role", "admin");

      if ((count ?? 0) === 0) {
        if (!profile) {
          await supabaseAdmin
            .from("profiles")
            .insert({ id: context.userId, bar_id: barId, full_name: null });
        }
        await supabaseAdmin
          .from("user_roles")
          .insert({ bar_id: barId, user_id: context.userId, role: "admin" });
        return { barId, roles: ["admin"] };
      }
      return { barId, roles: [] as string[] };
    }

    return { barId, roles: myRoles.map((r) => r.role) };
  });
