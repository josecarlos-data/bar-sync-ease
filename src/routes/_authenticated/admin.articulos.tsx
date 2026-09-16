import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Plus, Pencil } from "lucide-react";
import { StaffShell } from "@/components/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import { useItemImages, resolveImage } from "@/lib/images";
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
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

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
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="font-display mb-2 text-lg font-bold">{cat.name}</h2>
            <div className="space-y-2">
              {items
                .filter((i) => i.category_id === cat.id)
                .map((item) => (
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

              <div>
                <p className="mb-1 text-sm font-semibold">Alérgenos</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => {
                    const on = (draft.allergens ?? []).includes(a.value);
                    return (
                      <button
                        key={a.value}
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
