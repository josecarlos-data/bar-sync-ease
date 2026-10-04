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
export type MenuSort = "alpha" | "popular" | "manual";

/** Agrupa artículos por sección y grupo, respetando el orden (position) del primer artículo de cada grupo. */
export function buildSections(categories: Category[], items: Item[], sort: MenuSort = "manual", popularity: Record<string, number> = {}): MenuSection[] {
  return categories
    .map((category) => {
      const catItems = items.filter((i) => i.category_id === category.id);
      const map = new Map<string, Item[]>();
      [...catItems]
        .sort((a, b) => a.position - b.position)
        .forEach((i) => {
          const key = i.group_name?.trim() || "";
          map.set(key, [...(map.get(key) ?? []), i]);
        });
      const groups = [...map.entries()].map(([name, list]) => ({
        name: name || null,
        items: [...list].sort((a, b) => {
          if (sort === "popular") {
            const difference = (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0);
            if (difference) return difference;
          }
          if (sort === "alpha" || sort === "popular") return a.name.localeCompare(b.name, "es");
          return a.position - b.position;
        }),
      }));
      return { category, groups, count: catItems.length };
    })
    .filter((s) => s.count > 0);
}
