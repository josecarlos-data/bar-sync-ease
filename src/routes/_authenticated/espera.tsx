import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, PhoneCall, UserCheck, X } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBarSettings, useStaff } from "@/hooks/useStaff";
import { useRealtime } from "@/hooks/useRealtime";
import { alertSoundReady, playAlert, unlockAlertSound } from "@/lib/alertSound";

export const Route = createFileRoute("/_authenticated/espera")({
  head: () => ({
    meta: [
      { title: "Lista de espera — Comandas de bar" },
      { name: "description", content: "Cola de espera del bar con tiempo esperando y aviso al entrar alguien." },
      { property: "og:title", content: "Lista de espera — Comandas de bar" },
      { property: "og:description", content: "Apuntados, llamados y sentados, en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WaitlistPage,
});

type Entry = {
  id: string;
  name: string;
  phone: string;
  people: number;
  status: "waiting" | "called" | "seated" | "cancelled" | "no_show";
  created_at: string;
  called_at: string | null;
  seated_at: string | null;
};

function waited(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function WaitlistPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  const started = useRef(0);

  const enabled = !!barId && settings?.waitlist_enabled === true;
  useRealtime("waitlist", ["waitlist_entries"], enabled);

  const { data } = useQuery({
    queryKey: ["waitlist", barId],
    enabled,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("bar_id", barId!)
        .order("created_at", { ascending: false })
        .limit(60);
      return (rows ?? []) as Entry[];
    },
  });

  const entries = data ?? [];
  const active = entries.filter((e) => e.status === "waiting" || e.status === "called");
  const done = entries.filter((e) => e.status !== "waiting" && e.status !== "called");

  // Avisa solo de los que llegan con la pantalla abierta.
  useEffect(() => {
    if (!data) return;
    if (!started.current) {
      started.current = Date.now();
      data.forEach((e) => seen.current.add(e.id));
      return;
    }
    const fresh = data.filter((e) => !seen.current.has(e.id) && e.status === "waiting");
    data.forEach((e) => seen.current.add(e.id));
    if (fresh.length) playAlert();
  }, [data]);

  async function setStatus(id: string, status: Entry["status"]) {
    const patch: { status: Entry["status"]; handled_by: string | null; called_at?: string; seated_at?: string } = {
      status,
      handled_by: staff?.userId ?? null,
    };
    if (status === "called") patch.called_at = new Date().toISOString();
    if (status === "seated") patch.seated_at = new Date().toISOString();
    const { error } = await supabase.from("waitlist_entries").update(patch).eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    qc.invalidateQueries();
  }

  if (!settings?.waitlist_enabled) {
    return (
      <StaffShell title="Lista de espera">
        <div className="rounded-xl border border-dashed bg-card p-6 text-center">
          <p className="font-semibold">La lista de espera está apagada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enciéndela en Ajustes → Funciones para que quien espere en la puerta pueda apuntarse.
          </p>
          <Button asChild className="mt-4">
            <Link to="/admin/ajustes">Ir a Ajustes</Link>
          </Button>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title="Lista de espera">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <p className="text-sm">
          <b>{active.length}</b> esperando · {done.filter((e) => e.status === "seated").length} sentados hoy
        </p>
        <Button size="sm" variant={alertSoundReady() ? "ghost" : "outline"} onClick={() => unlockAlertSound()}>
          <Bell className="mr-1 h-4 w-4" /> {alertSoundReady() ? "Avisos activos" : "Activar avisos"}
        </Button>
      </div>

      {active.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          Nadie esperando. Cuando alguien escanee una mesa ocupada podrá apuntarse desde su móvil.
        </p>
      )}

      <ul className="space-y-2">
        {active.map((e) => (
          <li key={e.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-lg font-extrabold">{e.name}</p>
              <span className="text-sm text-muted-foreground">{waited(e.created_at)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {e.people} {e.people === 1 ? "persona" : "personas"}
              {e.phone ? ` · ${e.phone}` : ""}
              {e.status === "called" ? " · llamado" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus(e.id, "called")}>
                <PhoneCall className="mr-1 h-4 w-4" /> Llamar
              </Button>
              <Button size="sm" onClick={() => setStatus(e.id, "seated")}>
                <UserCheck className="mr-1 h-4 w-4" /> Sentar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(e.id, "no_show")}>
                No vino
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(e.id, "cancelled")}>
                <X className="mr-1 h-4 w-4" /> Quitar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-bold">Hoy</h2>
          <ul className="divide-y divide-border rounded-xl border bg-card">
            {done.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span>
                  {e.name} · {e.people}
                </span>
                <span className="text-muted-foreground">
                  {e.status === "seated" ? "Sentado" : e.status === "no_show" ? "No vino" : "Quitado"}
                  {e.seated_at ? ` · ${new Date(e.seated_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StaffShell>
  );
}
