import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DAY_KEYS, parseHours, type DayHours, type WeekHours } from "@/lib/hours";
import type { BarSettings } from "@/lib/types";

const LANGS = [
  ["es", "Español"],
  ["en", "Inglés"],
  ["fr", "Francés"],
  ["de", "Alemán"],
  ["it", "Italiano"],
  ["pt", "Portugués"],
  ["ca", "Catalán"],
] as const;

const DAY_TITLES: Record<string, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

function toPlain(hours: WeekHours) {
  const out: Record<string, DayHours | null> = {};
  for (const k of DAY_KEYS) out[k] = hours[k] ?? null;
  return out;
}

/** Sección «Funciones» de Ajustes: cada mejora se enciende o apaga aquí. */
export function FeatureSwitchesCard({
  settings,
  onSave,
}: {
  settings: BarSettings;
  onSave: (patch: Partial<BarSettings>) => void;
}) {
  const [hours, setHours] = useState<WeekHours>(() => parseHours(settings.hours));
  const [bizum, setBizum] = useState({ phone: settings.bizum_phone ?? "", label: settings.bizum_label ?? "" });
  const [special, setSpecial] = useState({ text: settings.special_text ?? "", itemId: settings.special_item_id ?? "" });

  useEffect(() => setHours(parseHours(settings.hours)), [settings.hours]);
  useEffect(() => setBizum({ phone: settings.bizum_phone ?? "", label: settings.bizum_label ?? "" }), [settings.bizum_phone, settings.bizum_label]);
  useEffect(() => setSpecial({ text: settings.special_text ?? "", itemId: settings.special_item_id ?? "" }), [settings.special_text, settings.special_item_id]);

  const { data: items = [] } = useQuery({
    queryKey: ["items-for-special", settings.bar_id],
    enabled: !!settings.special_enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name")
        .eq("bar_id", settings.bar_id)
        .order("name");
      return data ?? [];
    },
  });

  const langs = settings.menu_languages ?? ["es"];

  function toggleLang(code: string) {
    if (code === "es") return;
    const next = langs.includes(code) ? langs.filter((l) => l !== code) : [...langs, code];
    const current = settings.menu_default_language ?? "es";
    onSave({ menu_languages: next, menu_default_language: next.includes(current) ? current : "es" });
  }

  function setDay(key: string, patch: DayHours | null) {
    const next = { ...hours, [key]: patch };
    setHours(next);
    onSave({ hours: toPlain(next) });
  }

  return (
    <div className="space-y-3">
      <p className="pt-2 font-display text-lg font-bold">Funciones</p>
      <p className="text-sm text-muted-foreground">
        Apagadas por defecto: enciende solo lo que le sirva a tu bar y apágalo cuando deje de hacerte falta.
      </p>

      <Toggle
        label="Cuentas de fiado"
        help="Aparece «Fiado» en el menú para apuntar consumiciones por nombre y pasar la cuenta luego, con ticket e IVA."
        on={!!settings.tabs_enabled}
        onChange={(v) => onSave({ tabs_enabled: v })}
      />

      <Toggle
        label="Bizum"
        help="Imprime tu número de Bizum en el ticket y añade «Bizum» al marcar una cuenta como cobrada. No cobra solo: tú confirmas que te ha llegado."
        on={!!settings.bizum_enabled}
        onChange={(v) => onSave({ bizum_enabled: v })}
      >
        {settings.bizum_enabled && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Número de Bizum"
              value={bizum.phone}
              onChange={(e) => setBizum({ ...bizum, phone: e.target.value })}
              onBlur={() => onSave({ bizum_phone: bizum.phone.trim() })}
              maxLength={20}
            />
            <Input
              placeholder="Titular (Bar Mendoza)"
              value={bizum.label}
              onChange={(e) => setBizum({ ...bizum, label: e.target.value })}
              onBlur={() => onSave({ bizum_label: bizum.label.trim() })}
              maxLength={40}
            />
          </div>
        )}
      </Toggle>

      <Toggle
        label="Lista de espera"
        help="Quien escanee una mesa ocupada puede apuntarse con nombre y personas, y verás la cola en «Espera»."
        on={!!settings.waitlist_enabled}
        onChange={(v) => onSave({ waitlist_enabled: v })}
      />

      <Toggle
        label="Horario de apertura"
        help="El cliente ve si está abierto y, si no, cuándo abre. No bloquea los pedidos: es un aviso."
        on={!!settings.hours_enabled}
        onChange={(v) => onSave({ hours_enabled: v })}
      >
        {settings.hours_enabled && (
          <div className="mt-3 space-y-1">
            {DAY_KEYS.map((k) => {
              const d = hours[k];
              return (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 font-semibold">{DAY_TITLES[k]}</span>
                  {d ? (
                    <>
                      <input
                        type="time"
                        className="rounded-md border border-border bg-background px-2 py-1"
                        value={d.open}
                        onChange={(e) => setHours({ ...hours, [k]: { open: e.target.value, close: d.close } })}
                        onBlur={(e) => setDay(k, { open: e.target.value || "10:00", close: d.close })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="time"
                        className="rounded-md border border-border bg-background px-2 py-1"
                        value={d.close}
                        onChange={(e) => setHours({ ...hours, [k]: { open: d.open, close: e.target.value } })}
                        onBlur={(e) => setDay(k, { open: d.open, close: e.target.value || "23:00" })}
                      />
                      <button className="ml-auto text-xs text-muted-foreground underline" onClick={() => setDay(k, null)}>
                        Cerrado
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Cerrado</span>
                      <button className="ml-auto text-xs text-muted-foreground underline" onClick={() => setDay(k, { open: "10:00", close: "23:00" })}>
                        Añadir horario
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              Si cierra más tarde de medianoche (p. ej. 20:00–02:00) se entiende como la noche de ese día.
            </p>
          </div>
        )}
      </Toggle>

      <Toggle
        label="Especial del día"
        help="Una tarjeta arriba de la carta con lo de hoy: un plato de la carta o un texto suelto."
        on={!!settings.special_enabled}
        onChange={(v) => onSave({ special_enabled: v })}
      >
        {settings.special_enabled && (
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Ej.: guiso de habas con perdiz, 9,50 €"
              value={special.text}
              onChange={(e) => setSpecial({ ...special, text: e.target.value })}
              onBlur={() => onSave({ special_text: special.text.trim() })}
              maxLength={90}
            />
            <label className="block text-sm">
              <span className="text-muted-foreground">O enlázalo con un plato de la carta</span>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={special.itemId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSpecial({ ...special, itemId: id });
                  onSave({ special_item_id: id || null });
                }}
              >
                <option value="">Sin plato asociado</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Toggle>

      <Toggle
        label="«Hoy no hay» en la carta"
        help="Los artículos agotados dejan de ocultarse y salen en una lista discreta, para que nadie pregunte por lo que ya no queda."
        on={!!settings.show_sold_out_notice}
        onChange={(v) => onSave({ show_sold_out_notice: v })}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-semibold">Idiomas de la carta</p>
        <p className="text-sm text-muted-foreground">
          El cliente entra en el idioma de su móvil y puede cambiarlo arriba. El español siempre está activo.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGS.map(([code, label]) => {
            const on = code === "es" || langs.includes(code);
            return (
              <button
                key={code}
                onClick={() => toggleLang(code)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  help,
  on,
  onChange,
  children,
}: {
  label: string;
  help: string;
  on: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block font-semibold">{label}</span>
          <span className="block text-sm text-muted-foreground">{help}</span>
        </span>
        <Switch checked={on} onCheckedChange={onChange} />
      </label>
      {on && children}
    </div>
  );
}
