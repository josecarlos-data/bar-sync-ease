import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import type { AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/personal")({
  head: () => ({
    meta: [
      { title: "Personal — Comandas de bar" },
      { name: "description", content: "Roles del equipo: administrador, camarero, barra y cocina." },
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
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["staff-list", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role").eq("bar_id", barId!),
        supabase.from("profiles").select("id, full_name").eq("bar_id", barId!),
      ]);
      const byUser = new Map<string, { userId: string; name: string; roles: AppRole[] }>();
      for (const profile of profiles ?? []) {
        byUser.set(profile.id, {
          userId: profile.id,
          name: profile.full_name ?? "Sin nombre",
          roles: [],
        });
      }
      for (const role of roles ?? []) {
        const entry = byUser.get(role.user_id) ?? {
          userId: role.user_id,
          name: "Sin nombre",
          roles: [],
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
      if (error) return toast.error("No se pudo quitar el rol");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ bar_id: barId!, user_id: userId, role });
      if (error) return toast.error("No se pudo asignar el rol");
    }
    queryClient.invalidateQueries();
  }

  return (
    <StaffShell title="Personal">
      <p className="mb-3 text-sm text-muted-foreground">
        Cada persona crea su cuenta desde la pantalla de acceso; aquí decides qué puede hacer.
      </p>
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.userId} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">
              {member.name}
              {member.userId === staff?.userId && (
                <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
              )}
            </p>
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
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
