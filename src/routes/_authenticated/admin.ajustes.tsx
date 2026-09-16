import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { BarSettings } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes del bar — Comandas de bar" },
      { name: "description", content: "Precios, colas, aprobación de mesas y pagos." },
    ],
  }),
  component: SettingsPage,
});

const TOGGLES: { key: keyof BarSettings; label: string; help: string }[] = [
  { key: "show_prices", label: "Mostrar precios al cliente", help: "Se muestran por defecto." },
  {
    key: "split_bar_kitchen",
    label: "Barra y cocina separadas",
    help: "Desactívalo para una sola cola.",
  },
  {
    key: "waiter_can_order",
    label: "El camarero puede pedir por cualquier mesa",
    help: "Activo por defecto.",
  },
  {
    key: "free_tapa_with_drink",
    label: "Tapa gratis con bebida",
    help: "Con cada bebida el cliente elige una tapa sin coste (fase 2).",
  },
  {
    key: "payments_enabled",
    label: "Pasarela de pago",
    help: "Puedes activarla y desactivarla cuando quieras (fase 3).",
  },
];

function SettingsPage() {
  const { data: staff } = useStaff();
  const { data: settings } = useBarSettings(staff?.barId);
  const queryClient = useQueryClient();

  async function update(patch: Partial<BarSettings>) {
    const { error } = await supabase
      .from("bar_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("bar_id", staff!.barId!);
    if (error) { toast.error("No se pudo guardar"); return; }
    toast.success("Guardado");
    queryClient.invalidateQueries();
  }

  return (
    <StaffShell title="Ajustes del bar">
      {!settings && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {settings && (
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <span>
                <span className="block font-semibold">{t.label}</span>
                <span className="block text-sm text-muted-foreground">{t.help}</span>
              </span>
              <Switch
                checked={Boolean(settings[t.key])}
                onCheckedChange={(checked) => update({ [t.key]: checked } as Partial<BarSettings>)}
              />
            </label>
          ))}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">Orden de la cola</p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["arrival", "Llegada"],
                  ["table", "Mesa"],
                  ["product", "Producto"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => update({ queue_sort: value })}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    settings.queue_sort === value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">Cierre automático de mesas</p>
            <p className="text-sm text-muted-foreground">
              Las mesas sin actividad se cierran solas pasadas estas horas.
            </p>
            <Input
              type="number"
              min={1}
              max={24}
              className="mt-2 w-24"
              defaultValue={settings.auto_close_hours}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value >= 1 && value <= 24 && value !== settings.auto_close_hours) {
                  update({ auto_close_hours: value });
                }
              }}
            />
          </div>
        </div>
      )}
    </StaffShell>
  );
}
