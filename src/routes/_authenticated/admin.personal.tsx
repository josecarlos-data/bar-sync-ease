import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import {
  createStaffUser,
  deleteStaffUser,
  setStaffActive,
  setStaffPassword,
} from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/personal")({
  head: () => ({
    meta: [
      { title: "Personal — Comandas de bar" },
      { name: "description", content: "Crea cuentas de personal y decide qué puede hacer cada una." },
      { property: "og:title", content: "Personal — Comandas de bar" },
      {
        property: "og:description",
        content: "Altas de camareros, barra y cocina con usuario y contraseña.",
      },
    ],
  }),
  component: StaffPage,
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "waiter", label: "Camarero" },
  { value: "bar", label: "Barra" },
  { value: "kitchen", label: "Cocina" },
];

function StaffPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const isAdmin = (staff?.roles ?? []).includes("admin");
  const queryClient = useQueryClient();

  const createUser = useServerFn(createStaffUser);
  const changePassword = useServerFn(setStaffPassword);
  const changeActive = useServerFn(setStaffActive);
  const removeUser = useServerFn(deleteStaffUser);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["waiter"]);

  const { data: members = [] } = useQuery({
    queryKey: ["staff-list", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [{ data: roleRows }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role").eq("bar_id", barId!),
        supabase.from("profiles").select("id, full_name, username, is_active").eq("bar_id", barId!),
      ]);
      const byUser = new Map<
        string,
        { userId: string; name: string; username: string | null; active: boolean; roles: AppRole[] }
      >();
      for (const profile of profiles ?? []) {
        byUser.set(profile.id, {
          userId: profile.id,
          name: profile.full_name ?? "Sin nombre",
          username: profile.username ?? null,
          active: profile.is_active !== false,
          roles: [],
        });
      }
      for (const role of roleRows ?? []) {
        const entry = byUser.get(role.user_id) ?? {
          userId: role.user_id,
          name: "Sin nombre",
          username: null,
          active: true,
          roles: [] as AppRole[],
        };
        entry.roles.push(role.role as AppRole);
        byUser.set(role.user_id, entry);
      }
      return [...byUser.values()];
    },
  });

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    if (has) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("bar_id", barId!)
        .eq("user_id", userId)
        .eq("role", role);
      if (error) { toast.error("No se pudo quitar el rol"); return; }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ bar_id: barId!, user_id: userId, role });
      if (error) { toast.error("No se pudo asignar el rol"); return; }
    }
    queryClient.invalidateQueries({ queryKey: ["staff-list", barId] });
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createUser({ data: { fullName, username, password, roles } });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      toast.success("Cuenta creada");
      setOpen(false);
      setFullName(""); setUsername(""); setPassword(""); setRoles(["waiter"]);
      queryClient.invalidateQueries({ queryKey: ["staff-list", barId] });
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(userId: string) {
    const value = window.prompt("Nueva contraseña (mínimo 6 caracteres)");
    if (!value) return;
    const res = await changePassword({ data: { userId, password: value } });
    if ("error" in res && res.error) { toast.error(res.error); return; }
    toast.success("Contraseña actualizada");
  }

  async function onToggleActive(userId: string, active: boolean) {
    const res = await changeActive({ data: { userId, active } });
    if ("error" in res && res.error) { toast.error(res.error); return; }
    toast.success(active ? "Cuenta activada" : "Cuenta desactivada");
    queryClient.invalidateQueries({ queryKey: ["staff-list", barId] });
  }

  async function onDelete(userId: string, name: string) {
    if (!window.confirm(`¿Borrar la cuenta de ${name}? No se puede deshacer.`)) return;
    const res = await removeUser({ data: { userId } });
    if ("error" in res && res.error) { toast.error(res.error); return; }
    toast.success("Cuenta borrada");
    queryClient.invalidateQueries({ queryKey: ["staff-list", barId] });
  }

  return (
    <StaffShell title="Personal">
      <p className="mb-3 text-sm text-muted-foreground">
        Las cuentas se crean aquí: un nombre de usuario (por ejemplo Mendoza1) y una contraseña.
        Nadie puede registrarse desde fuera.
      </p>

      {isAdmin && (
        <div className="mb-4">
          {!open ? (
            <Button className="h-11 w-full" onClick={() => setOpen(true)}>
              Nueva cuenta de personal
            </Button>
          ) : (
            <form onSubmit={submitNew} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Nombre</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María (barra)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="un">Usuario</Label>
                <Input
                  id="un"
                  required
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Mendoza1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Contraseña</Label>
                <Input id="pw" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const has = roles.includes(role.value);
                  return (
                    <button
                      type="button"
                      key={role.value}
                      onClick={() =>
                        setRoles(has ? roles.filter((r) => r !== role.value) : [...roles, role.value])
                      }
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                        has ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="h-11 flex-1" disabled={busy}>Crear cuenta</Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.userId} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">
              {member.name}
              {member.userId === staff?.userId && (
                <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
              )}
              {!member.active && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Desactivada
                </span>
              )}
            </p>
            {member.username && (
              <p className="text-xs text-muted-foreground">Usuario: {member.username}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const has = member.roles.includes(role.value);
                return (
                  <button
                    key={role.value}
                    onClick={() => toggleRole(member.userId, role.value, has)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                      has
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
            {isAdmin && member.userId !== staff?.userId && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button className="underline text-muted-foreground" onClick={() => onChangePassword(member.userId)}>
                  Cambiar contraseña
                </button>
                <button
                  className="underline text-muted-foreground"
                  onClick={() => onToggleActive(member.userId, !member.active)}
                >
                  {member.active ? "Desactivar" : "Activar"}
                </button>
                <button className="underline text-destructive" onClick={() => onDelete(member.userId, member.name)}>
                  Borrar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
