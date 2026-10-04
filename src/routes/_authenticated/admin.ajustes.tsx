import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { BarSettings } from "@/lib/types";
import { BusinessDataCard } from "@/components/BusinessDataCard";

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
            <p className="font-semibold">Forma de trabajar</p>
            <p className="text-sm text-muted-foreground">
              <b>Equipo</b>: barra, cocina y sala separadas, con todos los pasos. <b>Bar pequeño</b>: una o dos
              personas lo llevan todo; en Mesas aparece lo pendiente de cocina y la comanda puede marcarse
              "ya servida" al apuntarla. Puedes cambiarlo cuando quieras (p. ej. Equipo el fin de semana).
            </p>
            <div className="mt-2 flex gap-2">
              {([["team", "Equipo"], ["solo", "Bar pequeño"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => update({ service_mode: value })}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    (settings.service_mode ?? "team") === value
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
            <p className="font-semibold">Aprobación de mesas</p>
            <p className="text-sm text-muted-foreground">
              En automática la mesa se abre sola. En manual el camarero acepta cada mesa y sus
              comandas esperan hasta entonces. Se aplica a las mesas nuevas.
            </p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  [false, "Automática"],
                  [true, "Manual"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => update({ require_session_approval: value })}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    settings.require_session_approval === value
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

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">Voz de las indicaciones de cocina</p>
            <p className="text-sm text-muted-foreground">
              Las indicaciones se leen en voz alta en barra y cocina. La voz del dispositivo es
              gratis e instantánea; la voz IA suena más natural pero consume créditos de IA en cada
              lectura.
            </p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["device", "Voz del dispositivo"],
                  ["ai", "Voz IA (más cara)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => update({ kitchen_voice: value })}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    settings.kitchen_voice === value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm">
                <span className="block font-semibold">Reproducción automática</span>
                <span className="block text-muted-foreground">
                  Las indicaciones nuevas suenan solas al llegar. Si la desactivas, solo suenan al
                  pulsar el altavoz.
                </span>
              </span>
              <Switch
                checked={settings.kitchen_voice_auto}
                onCheckedChange={(checked) => update({ kitchen_voice_auto: checked })}
              />
            </label>
            <div className="mt-4">
              <p className="font-semibold">Lectura automática de comandas</p>
              <p className="text-sm text-muted-foreground">
                Qué se dice en voz alta cuando llega una comanda nueva a barra o cocina. El altavoz de
                cada comanda siempre permite escucharla entera al pulsarlo.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["off", "No leer"],
                    ["summary", "Solo aviso (“Nueva comanda, mesa 1”)"],
                    ["full", "Comanda completa"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => update({ order_voice_auto: value })}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                      (settings.order_voice_auto ?? "off") === value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-semibold">Impresora de cocina</span>
                <span className="block text-sm text-muted-foreground">
                  Imprime un ticket por comanda en un tablet/PC con impresora. Desactívala si trabajáis solo con pantalla.
                </span>
              </span>
              <Switch checked={!!settings.printer_enabled} onCheckedChange={(v) => update({ printer_enabled: v })} />
            </label>
            {settings.printer_enabled && (
              <div className="mt-3 space-y-3">
                {(
                  [
                    ["Cuándo imprimir", "printer_trigger", settings.printer_trigger ?? "new", [["new", "Al entrar la comanda"], ["ready", "Al estar preparada"]]],
                    ["Qué imprime", "printer_scope", settings.printer_scope ?? "kitchen", [["kitchen", "Cocina"], ["bar", "Barra"], ["both", "Ambas"]]],
                    ["Ancho del papel", "printer_width", String(settings.printer_width ?? 80), [["58", "58 mm"], ["80", "80 mm"]]],
                  ] as const
                ).map(([title, key, current, opts]) => (
                  <div key={key}>
                    <p className="text-sm font-semibold">{title}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {opts.map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => update({ [key]: key === "printer_width" ? Number(value) : value } as Partial<BarSettings>)}
                          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                            current === value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  En el dispositivo de cocina, activa "Este dispositivo imprime" en su pantalla de Cocina o Barra.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">Dirección pública de la carta (para los QR)</p>
            <p className="text-xs text-muted-foreground">
              La dirección de la app publicada, por ejemplo https://mi-bar.lovable.app. Los QR de las mesas la usarán siempre.
            </p>
            <input
              defaultValue={settings.public_base_url ?? ""}
              placeholder="https://..."
              onBlur={(e) => {
                let v = e.target.value.trim().replace(/\/+$/, "");
                if (v && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(v)) {
                  toast.error("Escribe una dirección que empiece por https://");
                  return;
                }
                const val = v || null;
                if (val !== (settings.public_base_url ?? null)) update({ public_base_url: val } as Partial<BarSettings>);
              }}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>

          <BusinessDataCard settings={settings} onSave={update} />
        </div>
      )}
    </StaffShell>
  );
}
