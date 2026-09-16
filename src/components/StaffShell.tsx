import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { useStaff } from "@/hooks/useStaff";
import type { ReactNode } from "react";

const NAV = [
  { to: "/camarero", label: "Mesas", roles: ["admin", "waiter"] },
  { to: "/barra", label: "Barra", roles: ["admin", "waiter", "bar"] },
  { to: "/cocina", label: "Cocina", roles: ["admin", "waiter", "kitchen"] },
  { to: "/historial", label: "Histórico", roles: ["admin", "waiter"] },
  { to: "/admin/articulos", label: "Carta", roles: ["admin"] },
  { to: "/admin/mesas", label: "QR", roles: ["admin"] },
  { to: "/admin/ajustes", label: "Ajustes", roles: ["admin"] },
  { to: "/admin/personal", label: "Personal", roles: ["admin"] },
] as const;

export function StaffShell({ title, children }: { title: string; children: ReactNode }) {
  const { data: staff } = useStaff();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const roles = staff?.roles ?? [];
  const visible = NAV.filter((n) => n.roles.some((r) => roles.includes(r)));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-display text-lg leading-tight font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">{staff?.fullName ?? staff?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <button
              onClick={signOut}
              aria-label="Cerrar sesión"
              className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {visible.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-4">{children}</main>
    </div>
  );
}
