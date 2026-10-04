import type { Category, Item } from "@/lib/types";

export const ITEM_TAGS = [
  { value: "especial", label: "Especial" },
  { value: "casera", label: "Casera" },
  { value: "picante", label: "Picante" },
  { value: "vegetariana", label: "Vegetariana" },
  { value: "nuevo", label: "Nuevo" },
] as const;

export function tagLabel(v: string) {
  return ITEM_TAGS.find((t) => t.value === v)?.label ?? v;
}

export type MenuGroup = { name: string | null; items: Item[] };
export type MenuSection = { category: Category; groups: MenuGroup[]; count: number };

/** Agrupa artículos por sección y grupo, respetando el orden (position) del primer artículo de cada grupo. */
export function buildSections(categories: Category[], items: Item[], sort: "group" | "alpha" = "group"): MenuSection[] {
  return categories
    .map((category) => {
      const catItems = items.filter((i) => i.category_id === category.id);
      if (sort === "alpha") {
        const sorted = [...catItems].sort((a, b) => a.name.localeCompare(b.name, "es"));
        return { category, groups: sorted.length ? [{ name: null, items: sorted }] : [], count: sorted.length };
      }
      const map = new Map<string, Item[]>();
      [...catItems]
        .sort((a, b) => a.position - b.position)
        .forEach((i) => {
          const key = i.group_name?.trim() || "";
          map.set(key, [...(map.get(key) ?? []), i]);
        });
      const groups = [...map.entries()].map(([name, list]) => ({ name: name || null, items: list }));
      return { category, groups, count: catItems.length };
    })
    .filter((s) => s.count > 0);
}
