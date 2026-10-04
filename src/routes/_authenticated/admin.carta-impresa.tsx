import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, useBarSettings } from "@/hooks/useStaff";
import { ALLERGENS, formatEUR } from "@/lib/allergens";
import { buildSections, type MenuSection } from "@/lib/menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Category, Item } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/carta-impresa")({
  head: () => ({
    meta: [
      { title: "Carta impresa — Comandas de bar" },
      { name: "description", content: "Diseña e imprime la carta del bar en tríptico, díptico, A4, A5 o cartel." },
    ],
  }),
  component: PrintMenuPage,
});

type Format = "tri" | "di" | "a4" | "a5" | "a3";
type Template = "clasica" | "moderna" | "pizarra";
type Opts = {
  format: Format;
  template: Template;
  color: string;
  prices: boolean;
  allergens: boolean;
  bleed: boolean;
  hidden: string[];
  title: string;
  slogan: string;
  address: string;
  hours: string;
  qrUrl: string;
};

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "tri", label: "Tríptico A4", hint: "A4 apaisado, plegado en 3, dos caras" },
  { value: "di", label: "Díptico A4", hint: "A4 apaisado, plegado en 2, dos caras" },
  { value: "a4", label: "Hoja A4", hint: "Una cara, dos columnas" },
  { value: "a5", label: "Carta de mesa A5", hint: "Una columna, para atril o funda" },
  { value: "a3", label: "Cartel A3", hint: "Para pared o pizarra" },
];

const TEMPLATES: Record<Template, { label: string; bg: string; fg: string; muted: string; font: string; head: string }> = {
  clasica: { label: "Clásica / taberna", bg: "#faf5ea", fg: "#2b1d12", muted: "#7a6650", font: "Georgia, 'Times New Roman', serif", head: "Georgia, serif" },
  moderna: { label: "Moderna", bg: "#ffffff", fg: "#111111", muted: "#6b6b6b", font: "'Helvetica Neue', Arial, sans-serif", head: "'Helvetica Neue', Arial, sans-serif" },
  pizarra: { label: "Pizarra", bg: "#1f2422", fg: "#f3f0e6", muted: "#b9b5a8", font: "'Trebuchet MS', sans-serif", head: "'Bradley Hand', 'Comic Sans MS', cursive" },
};

const SIZES: Record<Format, { w: number; h: number; page: string }> = {
  tri: { w: 297, h: 210, page: "A4 landscape" },
  di: { w: 297, h: 210, page: "A4 landscape" },
  a4: { w: 210, h: 297, page: "A4 portrait" },
  a5: { w: 148, h: 210, page: "A5 portrait" },
  a3: { w: 297, h: 420, page: "A3 portrait" },
};

function PrintMenuPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["print-menu", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [bar, cats, items] = await Promise.all([
        supabase.from("bars").select("name").eq("id", barId!).maybeSingle(),
        supabase.from("categories").select("*").eq("bar_id", barId!).order("position"),
        supabase.from("items").select("*").eq("bar_id", barId!).order("position"),
      ]);
      return { barName: bar.data?.name ?? "", categories: (cats.data ?? []) as Category[], items: (items.data ?? []) as unknown as Item[] };
    },
  });

  const [opts, setOpts] = useState<Opts | null>(null);
  useEffect(() => {
    if (opts || !settings || !data) return;
    const saved = (settings.menu_print ?? {}) as Partial<Opts>;
    setOpts({
      format: "tri",
      template: "clasica",
      color: "#9a3412",
      prices: true,
      allergens: true,
      bleed: false,
      hidden: [],
      title: data.barName,
      slogan: "Tapas y raciones",
      address: settings.address ?? "",
      hours: "",
      qrUrl: settings.public_base_url ?? "",
      ...saved,
    });
  }, [settings, data, opts]);

  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!opts?.qrUrl) { setQr(null); return; }
    QRCode.toDataURL(opts.qrUrl, { width: 400, margin: 0 }).then(setQr).catch(() => setQr(null));
  }, [opts?.qrUrl]);

  const sections = useMemo(
    () => buildSections((data?.categories ?? []).filter((c) => !opts?.hidden.includes(c.id)), data?.items ?? []),
    [data, opts?.hidden],
  );

  if (!opts || !data) return <StaffShell title="Carta impresa"><p className="text-muted-foreground">Cargando…</p></StaffShell>;
  const set = (p: Partial<Opts>) => setOpts({ ...opts, ...p });

  async function save() {
    const { error } = await supabase.from("bar_settings").update({ menu_print: opts as unknown as never }).eq("bar_id", barId!);
    if (error) toast.error("No se pudo guardar");
    else { toast.success("Diseño guardado"); queryClient.invalidateQueries(); }
  }

  const size = SIZES[opts.format];

  return (
    <StaffShell title="Carta impresa">
      <style>{`
        @page { size: ${size.page}; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; zoom: 1 !important; }
          .print-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
        }
      `}</style>
      <Link to="/admin/articulos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a la carta
      </Link>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Block title="Formato">
            <div className="grid gap-1.5">
              {FORMATS.map((f) => (
                <button key={f.value} onClick={() => set({ format: f.value })}
                  className={`rounded-lg border p-2 text-left ${opts.format === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  <p className="text-sm font-semibold">{f.label}</p>
                  <p className="text-xs opacity-80">{f.hint}</p>
                </button>
              ))}
            </div>
          </Block>
          <Block title="Estilo">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TEMPLATES) as Template[]).map((t) => (
                <button key={t} onClick={() => set({ template: t })}
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${opts.template === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {TEMPLATES[t].label}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center justify-between text-sm">Color principal
              <input type="color" value={opts.color} onChange={(e) => set({ color: e.target.value })} className="h-8 w-12 rounded" />
            </label>
          </Block>
          <Block title="Portada y datos">
            <Input placeholder="Nombre del bar" value={opts.title} onChange={(e) => set({ title: e.target.value })} />
            <Input placeholder="Eslogan" value={opts.slogan} onChange={(e) => set({ slogan: e.target.value })} />
            <Input placeholder="Dirección" value={opts.address} onChange={(e) => set({ address: e.target.value })} />
            <Input placeholder="Horario (p. ej. Mar-Dom 12-16 y 20-24)" value={opts.hours} onChange={(e) => set({ hours: e.target.value })} />
            <Input placeholder="QR: enlace a tu web o redes (opcional)" value={opts.qrUrl} onChange={(e) => set({ qrUrl: e.target.value })} />
          </Block>
          <Block title="Contenido">
            <Toggle label="Mostrar precios" value={opts.prices} onChange={(v) => set({ prices: v })} />
            <Toggle label="Mostrar alérgenos (con leyenda)" value={opts.allergens} onChange={(v) => set({ allergens: v })} />
            <Toggle label="Sangrado y marcas para imprenta" value={opts.bleed} onChange={(v) => set({ bleed: v })} />
            <p className="pt-1 text-xs font-semibold text-muted-foreground">Secciones incluidas</p>
            {data.categories.map((c) => (
              <Toggle key={c.id} label={c.name} value={!opts.hidden.includes(c.id)}
                onChange={(v) => set({ hidden: v ? opts.hidden.filter((x) => x !== c.id) : [...opts.hidden, c.id] })} />
            ))}
          </Block>
          <div className="flex gap-2">
            <button onClick={save} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-sm font-semibold">
              <Save className="h-4 w-4" /> Guardar diseño
            </button>
            <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Para la imprenta: en la ventana de imprimir elige "Guardar como PDF", márgenes "Ninguno" y activa "Gráficos de fondo".
            {opts.format === "tri" || opts.format === "di" ? " Imprime a doble cara, volteando por el borde corto." : ""}
          </p>
        </aside>
        <div className="overflow-auto rounded-xl bg-muted p-4">
          <div id="print-area" style={{ zoom: { tri: 0.42, di: 0.42, a4: 0.55, a5: 0.75, a3: 0.36 }[opts.format] }}>
            <Sheets opts={opts} sections={sections} qr={qr} />
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      {label}
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

/* ---------- Maquetación imprimible (mm, colores propios de la plantilla) ---------- */

function Sheets({ opts, sections, qr }: { opts: Opts; sections: MenuSection[]; qr: string | null }) {
  const t = TEMPLATES[opts.template];
  const size = SIZES[opts.format];
  const bleed = opts.bleed ? 3 : 0;
  const usedAllergens = ALLERGENS.filter((a) => sections.some((s) => s.groups.some((g) => g.items.some((i) => (i.allergens as string[]).includes(a.value)))));
  const allergenIndex = (v: string) => ALLERGENS.findIndex((a) => a.value === v) + 1;

  const sheet = (children: React.ReactNode, key: string, panels = 1) => (
    <div key={key} className="print-sheet" style={{
      width: `${size.w + bleed * 2}mm`, height: `${size.h + bleed * 2}mm`, padding: `${bleed}mm`, background: t.bg, color: t.fg,
      fontFamily: t.font, margin: "0 auto 24px", boxShadow: "0 4px 24px rgba(0,0,0,.25)", position: "relative", overflow: "hidden", boxSizing: "border-box",
    }}>
      {opts.bleed && <CropMarks bleed={bleed} />}
      {panels > 1 && Array.from({ length: panels - 1 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${bleed + (size.w / panels) * (i + 1)}mm`, borderLeft: `0.2mm dashed ${t.muted}`, opacity: 0.35 }} />
      ))}
      {children}
    </div>
  );

  const menuBody = (columns: number) => (
    <div style={{ columnCount: columns, columnGap: "10mm", columnFill: "auto", height: "100%", padding: "10mm", boxSizing: "border-box", fontSize: "9pt" }}>
      {sections.map((s) => (
        <div key={s.category.id} style={{ marginBottom: "5mm" }}>
          <h2 style={{ fontFamily: t.head, color: opts.color, fontSize: "16pt", margin: "0 0 2mm", breakAfter: "avoid", borderBottom: `0.4mm solid ${opts.color}` }}>{s.category.name}</h2>
          {s.groups.map((g) => (
            <div key={g.name ?? "_"} style={{ marginBottom: "2.5mm" }}>
              {g.name && <h3 style={{ fontSize: "8pt", letterSpacing: "0.12em", textTransform: "uppercase", color: t.muted, margin: "1.5mm 0 1mm", breakAfter: "avoid" }}>{g.name}</h3>}
              {g.items.map((i) => (
                <div key={i.id} style={{ breakInside: "avoid", marginBottom: "1.2mm" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "2mm" }}>
                    <span style={{ fontWeight: 700 }}>{i.name}</span>
                    {opts.allergens && i.allergens.length > 0 && (
                      <sup style={{ color: t.muted, fontSize: "6.5pt" }}>{i.allergens.map(allergenIndex).join(" ")}</sup>
                    )}
                    {opts.prices && <span style={{ flex: 1, borderBottom: `0.2mm dotted ${t.muted}`, transform: "translateY(-1mm)" }} />}
                    {opts.prices && <span style={{ fontWeight: 700 }}>{formatEUR(Number(i.price))}</span>}
                  </div>
                  {i.description && <div style={{ color: t.muted, fontSize: "7.5pt", fontStyle: "italic" }}>{i.description}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const legend = opts.allergens && usedAllergens.length > 0 && (
    <div style={{ fontSize: "7pt", color: t.muted }}>
      <strong style={{ color: t.fg }}>Alérgenos: </strong>
      {usedAllergens.map((a) => `${allergenIndex(a.value)} ${a.label}`).join(" · ")}. Consulte al personal ante cualquier alergia o intolerancia.
    </div>
  );

  const cover = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "12mm", boxSizing: "border-box" }}>
      <div style={{ width: "18mm", height: "0.8mm", background: opts.color, marginBottom: "6mm" }} />
      <h1 style={{ fontFamily: t.head, fontSize: "30pt", lineHeight: 1.05, margin: 0 }}>{opts.title}</h1>
      {opts.slogan && <p style={{ color: opts.color, fontSize: "12pt", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: "4mm" }}>{opts.slogan}</p>}
      <div style={{ width: "18mm", height: "0.8mm", background: opts.color, marginTop: "6mm" }} />
    </div>
  );

  const info = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "4mm", padding: "12mm", boxSizing: "border-box", fontSize: "9pt" }}>
      {qr && <img src={qr} alt="QR" style={{ width: "28mm", height: "28mm", alignSelf: "center", background: "#fff", padding: "2mm" }} />}
      {opts.address && <p><strong>Dónde estamos</strong><br />{opts.address}</p>}
      {opts.hours && <p><strong>Horario</strong><br />{opts.hours}</p>}
      {legend}
      <p style={{ fontSize: "7pt", color: t.muted }}>IVA incluido. Hojas de reclamaciones a disposición del cliente.</p>
    </div>
  );

  const header = (
    <div style={{ padding: "10mm 10mm 0", textAlign: "center" }}>
      <h1 style={{ fontFamily: t.head, fontSize: opts.format === "a3" ? "40pt" : "24pt", margin: 0 }}>{opts.title}</h1>
      {opts.slogan && <p style={{ color: opts.color, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "9pt" }}>{opts.slogan}</p>}
    </div>
  );
  const footer = (
    <div style={{ position: "absolute", left: `${bleed + 10}mm`, right: `${bleed + 10}mm`, bottom: `${bleed + 6}mm`, display: "flex", gap: "4mm", alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>{legend}<p style={{ fontSize: "7pt", color: t.muted }}>{[opts.address, opts.hours, "IVA incluido"].filter(Boolean).join(" · ")}</p></div>
      {qr && <img src={qr} alt="QR" style={{ width: "18mm", height: "18mm", background: "#fff", padding: "1mm" }} />}
    </div>
  );

  const row = (cols: React.ReactNode[]) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, height: "100%" }}>{cols.map((c, i) => <div key={i} style={{ height: "100%", overflow: "hidden" }}>{c}</div>)}</div>
  );

  if (opts.format === "tri") {
    return <>
      {sheet(row([info, <div key="b" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: "8pt" }}>{opts.title}</div>, cover]), "out", 3)}
      {sheet(menuBody(3), "in", 3)}
    </>;
  }
  if (opts.format === "di") {
    return <>
      {sheet(row([info, cover]), "out", 2)}
      {sheet(menuBody(2), "in", 2)}
    </>;
  }
  const cols = opts.format === "a5" ? 1 : opts.format === "a4" ? 2 : 3;
  return sheet(
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {header}
      <div style={{ flex: 1, minHeight: 0, paddingBottom: "22mm" }}>{menuBody(cols)}</div>
      {footer}
    </div>,
    "single",
  );
}

function CropMarks({ bleed }: { bleed: number }) {
  const m = `${bleed}mm`;
  const style = (pos: React.CSSProperties): React.CSSProperties => ({ position: "absolute", width: m, height: m, borderColor: "#000", ...pos });
  return <>
    <div style={style({ top: 0, left: 0, borderRight: "0.2mm solid", borderBottom: "0.2mm solid" })} />
    <div style={style({ top: 0, right: 0, borderLeft: "0.2mm solid", borderBottom: "0.2mm solid" })} />
    <div style={style({ bottom: 0, left: 0, borderRight: "0.2mm solid", borderTop: "0.2mm solid" })} />
    <div style={style({ bottom: 0, right: 0, borderLeft: "0.2mm solid", borderTop: "0.2mm solid" })} />
  </>;
}
