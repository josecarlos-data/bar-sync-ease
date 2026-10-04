import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, HelpCircle, ImagePlus, Plus, Pencil, Printer } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ITEM_TAGS, buildSections } from "@/lib/menu";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import { useItemImages, resolveImage } from "@/lib/images";
import { useBarSettings } from "@/hooks/useStaff";
import type { MenuSort } from "@/lib/menu";
import { useMenuPopularity } from "@/hooks/useMenuPopularity";
import { AllergenAssistant } from "@/components/AllergenAssistant";
import { Button } from "@/components/ui/button";
import { ALLERGENS, formatEUR } from "@/lib/allergens";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Category, Destination, Item } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/articulos")({
  head: () => ({
    meta: [
      { title: "Carta — Comandas de bar" },
      { name: "description", content: "Artículos, precios, alérgenos y disponibilidad." },
    ],
  }),
  component: ItemsPage,
});

type Draft = Partial<Item> & { name: string };

const EMPTY: Draft = {
  name: "",
  price: 0,
  tax_rate: 10,
  allergens: [],
  available: true,
  destination: "bar",
  is_drink: false,
  is_tapa: false,
};

function ItemsPage() {
  const { data: staff } = useStaff();
  const barId = staff?.barId ?? null;
  const { data: settings } = useBarSettings(barId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [allergenHelpOpen, setAllergenHelpOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-carta", barId],
    enabled: !!barId,
    queryFn: async () => {
      const [cats, items] = await Promise.all([
        supabase.from("categories").select("*").eq("bar_id", barId!).order("position"),
        supabase.from("items").select("*").eq("bar_id", barId!).order("position"),
      ]);
      return {
        categories: (cats.data ?? []) as Category[],
        items: (items.data ?? []) as Item[],
      };
    },
  });

  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const { data: imageMap } = useItemImages(items.map((i) => i.image_url));

  async function addCategory() {
    const name = window.prompt("Nombre de la categoría");
    if (!name) return;
    const { error } = await supabase
      .from("categories")
      .insert({ bar_id: barId!, name, position: categories.length });
    if (error) { toast.error("No se pudo crear la categoría"); return; }
    queryClient.invalidateQueries();
  }

  async function toggleAvailable(item: Item) {
    const { error } = await supabase
      .from("items")
      .update({ available: !item.available })
      .eq("id", item.id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    queryClient.invalidateQueries();
  }

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${barId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("item-images").upload(path, file);
    if (error) {
      toast.error("No se pudo subir la imagen");
      return null;
    }
    return path;
  }

  async function save() {
    if (!draft?.name.trim()) { toast.error("Ponle un nombre al artículo"); return; }
    setSaving(true);
    const payload = {
      bar_id: barId!,
      category_id: draft.category_id ?? null,
      name: draft.name.trim(),
      description: draft.description ?? null,
      price: Number(draft.price ?? 0),
      tax_rate: Number(draft.tax_rate ?? 10),
      image_url: draft.image_url ?? null,
      allergens: draft.allergens ?? [],
      available: draft.available ?? true,
      destination: (draft.destination ?? "bar") as Destination,
      is_drink: draft.is_drink ?? false,
      is_tapa: draft.is_tapa ?? false,
      group_name: draft.group_name?.trim() || null,
      tags: draft.tags ?? [],
      ingredients: draft.ingredients?.trim() || null,
    };
    const { error } = draft.id
      ? await supabase.from("items").update(payload).eq("id", draft.id)
      : await supabase.from("items").insert({ ...payload, position: items.length });
    setSaving(false);
    if (error) { toast.error("No se pudo guardar el artículo"); return; }
    toast.success("Artículo guardado");
    setDraft(null);
    queryClient.invalidateQueries();
  }

  async function move(list: Item[], index: number, dir: -1 | 1) {
    const other = list[index + dir];
    const item = list[index];
    if (!other || !item) return;
    const a = item.position, b = other.position;
    await Promise.all([
      supabase.from("items").update({ position: a === b ? b + dir : b }).eq("id", item.id),
      supabase.from("items").update({ position: a }).eq("id", other.id),
    ]);
    queryClient.invalidateQueries();
  }

  async function setMenuSort(value: MenuSort) {
    if (!barId) return;
    const { error } = await supabase.from("bar_settings").update({ menu_sort: value }).eq("bar_id", barId);
    if (error) { toast.error("No se pudo guardar el orden"); return; }
    queryClient.invalidateQueries({ queryKey: ["bar-settings", barId] });
    toast.success("Orden de la carta guardado");
  }

  const groupNames = [...new Set(items.map((i) => i.group_name).filter(Boolean))] as string[];
  const menuSort: MenuSort = (settings?.menu_sort as MenuSort) ?? "alpha";
  const { data: popularity = {} } = useMenuPopularity(barId, menuSort === "popular");
  const sections = buildSections(categories, items, menuSort, popularity);

  return (
    <StaffShell title="Carta">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nuevo artículo
        </button>
        <button
          onClick={addCategory}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Nueva categoría
        </button>
        <Link
          to="/admin/carta-impresa"
          className="ml-auto flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          <Printer className="h-4 w-4" /> Carta impresa
        </Link>
      </div>

      <div className="mb-5 border-b border-border pb-4">
        <p className="mb-2 text-sm font-semibold">Orden de la carta virtual</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Orden de la carta virtual">
          {([ ["alpha", "Alfabético"], ["popular", "Más vendidos"], ["manual", "Manual"] ] as const).map(([value, label]) => (
            <Button key={value} variant={(settings?.menu_sort ?? "alpha") === value ? "default" : "outline"} size="sm" aria-pressed={(settings?.menu_sort ?? "alpha") === value} onClick={() => setMenuSort(value)}>{label}</Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Se respeta el orden de secciones y grupos. Más vendidos cuenta las unidades de los últimos 30 días; manual usa las flechas de cada grupo.</p>
        {menuSort !== "manual" && <p className="mt-1 text-xs font-medium">Cambia a Manual para ordenar a mano.</p>}
      </div>

      <div className="space-y-6">
        {sections.map(({ category: cat, groups }) => (
          <section key={cat.id}>
            <h2 className="font-display mb-2 text-lg font-bold">{cat.name}</h2>
            {groups.map((g) => (
            <div key={g.name ?? "_"} className="mb-3">
              {g.name && <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.name}</h3>}
            <div className="space-y-2">
              {g.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {resolveImage(item.image_url, imageMap) && (
                        <img
                          src={resolveImage(item.image_url, imageMap)!}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatEUR(item.price)} · {item.destination === "bar" ? "Barra" : "Cocina"}
                      </p>
                    </div>
                    {menuSort === "popular" && <span className="shrink-0 text-xs text-muted-foreground">{popularity[item.id] ?? 0} uds.</span>}
                    {menuSort === "manual" && <div className="flex flex-col">
                      <button aria-label="Subir" disabled={idx === 0} onClick={() => move(g.items, idx, -1)} className="p-0.5 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button aria-label="Bajar" disabled={idx === g.items.length - 1} onClick={() => move(g.items, idx, 1)} className="p-0.5 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>}
                    <Switch
                      checked={item.available}
                      onCheckedChange={() => toggleAvailable(item)}
                      aria-label="Disponible"
                    />
                    <button
                      onClick={() => setDraft({ ...item })}
                      className="rounded-md border border-border p-2"
                      aria-label={`Editar ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
            </div>
            ))}
          </section>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Input
                placeholder="Nombre"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                placeholder="Descripción"
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.10"
                  placeholder="Precio"
                  value={draft.price ?? 0}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="IVA %"
                  value={draft.tax_rate ?? 10}
                  onChange={(e) => setDraft({ ...draft, tax_rate: Number(e.target.value) })}
                />
              </div>

              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.category_id ?? ""}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <Input
                list="group-names"
                placeholder="Grupo dentro de la sección (p. ej. Cerdo, Frías…)"
                value={draft.group_name ?? ""}
                onChange={(e) => setDraft({ ...draft, group_name: e.target.value })}
              />
              <datalist id="group-names">
                {groupNames.map((g) => <option key={g} value={g} />)}
              </datalist>
              <div className="flex flex-wrap gap-1.5">
                {ITEM_TAGS.map((t) => {
                  const on = (draft.tags ?? []).includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, tags: on ? (draft.tags ?? []).filter((x) => x !== t.value) : [...(draft.tags ?? []), t.value] })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                {(
                  [
                    ["bar", "Va a barra"],
                    ["kitchen", "Va a cocina"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setDraft({ ...draft, destination: value })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      (draft.destination ?? "bar") === value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-semibold">
                Es bebida
                <Switch
                  checked={draft.is_drink ?? false}
                  onCheckedChange={(v) => setDraft({ ...draft, is_drink: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-semibold">
                Puede servirse como tapa
                <Switch
                  checked={draft.is_tapa ?? false}
                  onCheckedChange={(v) => setDraft({ ...draft, is_tapa: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-semibold">
                Disponible
                <Switch
                  checked={draft.available ?? true}
                  onCheckedChange={(v) => setDraft({ ...draft, available: v })}
                />
              </label>

              <AllergenAssistant
                barId={barId}
                name={draft.name}
                ingredients={draft.ingredients ?? ""}
                onIngredients={(v) => setDraft((d) => d && { ...d, ingredients: v })}
                onSuggest={(codes) => setDraft((d) => d && { ...d, allergens: [...new Set([...(d.allergens ?? []), ...codes])] as Item["allergens"] })}
                onDescription={(v) => setDraft((d) => d && { ...d, description: v })}
              />
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Alérgenos</p>
                  <button
                    type="button"
                    title="Ver ejemplos de cada alérgeno"
                    onClick={() => setAllergenHelpOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Ver ejemplos
                  </button>
                </div>
                {allergenHelpOpen && (
                  <ul className="mb-2 space-y-1 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px]">
                    {ALLERGENS.map((a) => (
                      <li key={a.value}>
                        <span className="font-semibold">{a.label}:</span>{" "}
                        <span className="text-muted-foreground">{a.examples}</span>
                        {(draft.allergens ?? []).includes(a.value) && (
                          <span className="ml-1 font-semibold text-accent">— marcado</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => {
                    const on = (draft.allergens ?? []).includes(a.value);
                    return (
                      <button
                        key={a.value}
                        title={a.examples}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            allergens: on
                              ? (draft.allergens ?? []).filter((x) => x !== a.value)
                              : [...(draft.allergens ?? []), a.value],
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          on
                            ? "bg-accent text-accent-foreground"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm font-semibold">
                <ImagePlus className="h-4 w-4" />
                {draft.image_url ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = await uploadImage(file);
                    if (path) setDraft({ ...draft, image_url: path });
                  }}
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffShell>
  );
}
