import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { BarSettings } from "@/lib/types";

export const FOOTER_TEMPLATES = {
  legal:
    "IVA incluido. Existen hojas de reclamaciones a disposición del cliente.",
  recommended:
    "IVA incluido. Existen hojas de reclamaciones a disposición del cliente. Este documento es una factura simplificada; si necesita factura completa con sus datos, solicítela al personal. ¡Gracias por su visita!",
} as const;

type Mode = "legal" | "recommended" | "free";
const FIELDS = [
  ["legal_name", "Razón social"],
  ["tax_id", "NIF / CIF"],
  ["address", "Dirección"],
  ["phone", "Teléfono"],
] as const;
type Key = (typeof FIELDS)[number][0] | "ticket_footer";

function modeOf(text: string): Mode {
  if (text.trim() === FOOTER_TEMPLATES.legal) return "legal";
  if (text.trim() === FOOTER_TEMPLATES.recommended) return "recommended";
  return "free";
}

export function BusinessDataCard({
  settings,
  onSave,
}: {
  settings: BarSettings;
  onSave: (patch: Partial<BarSettings>) => Promise<void>;
}) {
  const initial = () =>
    Object.fromEntries(
      [...FIELDS.map((f) => f[0]), "ticket_footer"].map((k) => [k, (settings[k as Key] as string | null) ?? ""]),
    ) as Record<Key, string>;
  const [draft, setDraft] = useState<Record<Key, string>>(initial);
  const [mode, setMode] = useState<Mode>(() => modeOf(draft.ticket_footer));

  const pending = (Object.keys(draft) as Key[]).filter(
    (k) => (draft[k].trim() || null) !== ((settings[k] as string | null) ?? null),
  );
  const pendingRef = useRef<() => void>(() => {});
  pendingRef.current = () => {
    if (pending.length) save();
  };

  function save(keys: Key[] = pending) {
    if (!keys.length) return Promise.resolve();
    const patch = Object.fromEntries(keys.map((k) => [k, draft[k].trim() || null]));
    return onSave(patch as Partial<BarSettings>);
  }

  useEffect(() => {
    const h = () => pendingRef.current();
    window.addEventListener("beforeunload", h);
    return () => {
      window.removeEventListener("beforeunload", h);
      pendingRef.current();
    };
  }, []);

  const set = (k: Key, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const blur = (k: Key) => {
    if (pending.includes(k)) save([k]);
  };

  const required: [Key, string][] = [
    ["legal_name", "Razón social"],
    ["tax_id", "NIF / CIF"],
    ["address", "Dirección"],
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-semibold">Datos del negocio (salen en tickets y facturas)</p>
      <div className="mt-2 space-y-2">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
              onBlur={() => blur(key)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        ))}

        <div className="text-sm">
          <span className="text-muted-foreground">Texto al pie del ticket</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {(
              [
                ["legal", "Legal mínimo"],
                ["recommended", "Recomendado"],
                ["free", "Libre"],
              ] as const
            ).map(([m, label]) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => {
                  setMode(m);
                  if (m !== "free") set("ticket_footer", FOOTER_TEMPLATES[m]);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <textarea
            rows={3}
            value={draft.ticket_footer}
            onChange={(e) => {
              set("ticket_footer", e.target.value);
              setMode(modeOf(e.target.value));
            }}
            onBlur={() => blur("ticket_footer")}
            placeholder="Escribe tu propio texto…"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">
            Orientativo, no sustituye el asesoramiento de tu gestoría. Revisa la normativa de tu comunidad autónoma.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-3 text-xs">
          <p className="mb-1 font-medium">Para que el ticket valga como factura simplificada</p>
          <ul className="space-y-1">
            {required.map(([k, label]) => {
              const ok = !!draft[k].trim();
              return (
                <li key={k} className="flex items-center gap-2">
                  {ok ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {label} {ok ? "" : "— falta"}
                </li>
              );
            })}
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" /> Número, fecha, desglose de IVA e "IVA incluido": los pone la app
            </li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            Orientativo, no sustituye el asesoramiento de tu gestoría.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
          <Switch
            checked={settings.verifactu_enabled === true}
            onCheckedChange={(v) => onSave({ verifactu_enabled: v })}
          />
          <span>
            <span className="font-medium">Registro de facturación verificable (VERI*FACTU)</span>
            <span className="block text-xs text-muted-foreground">
              Cada ticket y factura queda registrado con huella encadenada y lleva un QR de verificación. Los registros
              no se pueden modificar ni borrar.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            {pending.length ? "Cambios sin guardar" : "Guardado ✓"}
          </span>
          <Button type="button" disabled={!pending.length} onClick={() => save()}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
