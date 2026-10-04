import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Heart, Minus, Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { buildSections, tagLabel, type MenuSort } from "@/lib/menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Category, Item } from "@/lib/types";

type CartLine = { itemId: string; qty: number; note: string };

const FILTERS = ["gluten", "lacteos", "huevos", "pescado", "crustaceos", "moluscos", "frutos_cascara", "sulfitos"];

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function MenuBrowser({
  categories,
  items,
  cart,
  onQty,
  onNote,
  showPrices = true,
  favKey,
  images,
  stickyTop = "top-0",
  sort = "alpha",
}: {
  categories: Category[];
  items: Item[];
  cart: CartLine[];
  onQty: (itemId: string, delta: number) => void;
  onNote: (itemId: string, note: string) => void;
  showPrices?: boolean;
  favKey: string;
  images?: (item: Item) => string | null;
  stickyTop?: string;
  sort?: MenuSort;
}) {
  const [query, setQuery] = useState("");
  const [exclude, setExclude] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const barId = items[0]?.bar_id;
  const { data: popularity } = useQuery({
    queryKey: ["menu-popularity", barId],
    enabled: !!barId && sort === "popular",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("menu_popularity", { _bar_id: barId ?? "" });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.item_id, Number(row.units)])) as Record<string, number>;
    },
  });

  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(favKey) ?? "[]"));
    } catch {
      setFavs([]);
    }
  }, [favKey]);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(favKey, JSON.stringify(next));
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((i) => {
      if (exclude.some((a) => (i.allergens as string[]).includes(a))) return false;
      if (!q) return true;
      return normalize(`${i.name} ${i.description ?? ""} ${i.group_name ?? ""}`).includes(q);
    });
  }, [items, query, exclude]);

  const available = useMemo(() => filtered.filter((i) => i.available), [filtered]);
  const soldOut = filtered.filter((i) => !i.available);
  const sections = useMemo(() => buildSections(categories, available, sort, popularity), [categories, available, sort, popularity]);
  const favItems = items.filter((i) => favs.includes(i.id));

  // La sección activa es la última cuyo encabezado ha alcanzado el índice fijo.
  useEffect(() => {
    if (!sections.length) return;
    let frame = 0;
    const updateActive = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const threshold = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 40;
        let selected = sections[0]?.category.id;
        for (const section of sections) {
          const top = document.getElementById(`sec-${section.category.id}`)?.getBoundingClientRect().top;
          if (top !== undefined && top <= threshold) selected = section.category.id;
        }
        if (selected) setActive(selected);
      });
    };
    updateActive();
    window.addEventListener("scroll", updateActive, true);
    window.addEventListener("resize", updateActive);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActive, true);
      window.removeEventListener("resize", updateActive);
    };
  }, [sections]);

  useEffect(() => {
    if (!active) return;
    const nav = navRef.current;
    const chip = [...(nav?.children ?? [])].find((child) => child.getAttribute("data-cat") === active) as HTMLElement | undefined;
    if (nav && chip) nav.scrollTo({ left: chip.offsetLeft - nav.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 0;
    if (!el) return;
    const scrollParent = el.closest(".overflow-y-auto");
    if (scrollParent) scrollParent.scrollBy({ top: el.getBoundingClientRect().top - navBottom - 12, behavior: "smooth" });
    else window.scrollBy({ top: el.getBoundingClientRect().top - navBottom - 12, behavior: "smooth" });
    if (id.startsWith("sec-") && id !== "sec-favs") setActive(id.slice(4));
  }

  const renderItem = (item: Item) => {
    const line = cart.find((l) => l.itemId === item.id);
    return (
      <MenuItemRow
        key={item.id}
        item={item}
        image={images?.(item) ?? null}
        showPrices={showPrices}
        qty={line?.qty ?? 0}
        note={line?.note ?? ""}
        fav={favs.includes(item.id)}
        onFav={() => toggleFav(item.id)}
        onQty={(d) => onQty(item.id, d)}
        onNote={(n) => onNote(item.id, n)}
      />
    );
  };

  return (
    <div className="space-y-5">
      <div className={`sticky ${stickyTop} z-10 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 pb-2 pt-2 backdrop-blur`}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar en la carta…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <Button variant="ghost" size="icon" aria-label="Borrar búsqueda" onClick={() => setQuery("")} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" className={exclude.length ? "border-primary bg-primary text-primary-foreground" : ""}
            onClick={() => setShowFilters((v) => !v)}
          >
            Alérgenos{exclude.length ? ` (${exclude.length})` : ""}
          </Button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((a) => {
              const on = exclude.includes(a);
              return (
                <Button variant={on ? "default" : "outline"} size="sm"
                  key={a}
                  onClick={() => setExclude((p) => (on ? p.filter((x) => x !== a) : [...p, a]))}
                  className="h-7 rounded-full px-2.5 text-xs"
                >
                  Sin {allergenLabel(a).toLowerCase()}
                </Button>
              );
            })}
          </div>
        )}
        <div ref={navRef} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {favItems.length > 0 && (
            <Button variant="outline" size="sm"
              onClick={() => jumpTo("sec-favs")}
              className="h-8 shrink-0 rounded-full"
            >
              <Heart className="h-3.5 w-3.5 fill-current text-destructive" /> {favItems.length}
            </Button>
          )}
          {sections.map((s) => (
            <Button variant={active === s.category.id ? "default" : "outline"} size="sm"
              key={s.category.id}
              data-cat={s.category.id}
              onClick={() => jumpTo(`sec-${s.category.id}`)}
              className="h-8 shrink-0 rounded-full"
            >
              {s.category.name}
            </Button>
          ))}
        </div>
      </div>

      {favItems.length > 0 && !query && (
        <section id="sec-favs" className="scroll-mt-48 rounded-xl border border-border bg-secondary/40 p-3">
          <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-bold">
            <Heart className="h-4 w-4 fill-current text-destructive" /> Mis favoritas
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">Las que tenéis en mente. Añadid las que queráis pedir.</p>
          <div className="space-y-2">{favItems.filter((i) => i.available).map(renderItem)}</div>
        </section>
      )}

      {sections.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No hay nada que coincida.</p>}

      {sections.map((s) => (
        <section key={s.category.id} id={`sec-${s.category.id}`} className="scroll-mt-48">
          <h2 className="font-display mb-2 text-2xl font-bold">{s.category.name}</h2>
          <div className="space-y-4">
            {s.groups.map((g) => (
              <div key={g.name ?? "_"}>
                {g.name && (
                  <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {g.name} <span className="font-normal">· {g.items.length}</span>
                  </h3>
                )}
                <div className="space-y-2">{g.items.map(renderItem)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {soldOut.length > 0 && (
        <section className="rounded-xl bg-muted p-3">
          <h2 className="font-display mb-2 text-lg font-bold text-muted-foreground">Agotado</h2>
          <ul className="space-y-1">
            {soldOut.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="line-through">{item.name}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold">Agotado</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MenuItemRow({
  item,
  image,
  showPrices,
  qty,
  note,
  fav,
  onFav,
  onQty,
  onNote,
}: {
  item: Item;
  image: string | null;
  showPrices: boolean;
  qty: number;
  note: string;
  fav: boolean;
  onFav: () => void;
  onQty: (d: number) => void;
  onNote: (n: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(item.description?.trim() || image);
  return (
    <article className={`rounded-xl border bg-card p-3 ${qty > 0 ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon"
          aria-label={fav ? `Quitar ${item.name} de favoritas` : `Marcar ${item.name} como favorita`}
          onClick={onFav}
          className="h-8 w-8 shrink-0"
        >
          <Heart className={`h-5 w-5 ${fav ? "fill-current text-destructive" : "text-muted-foreground"}`} />
        </Button>
        <Button variant="ghost" aria-expanded={hasDetail ? open : undefined} disabled={!hasDetail} className="h-auto min-w-0 flex-1 justify-start whitespace-normal p-0 text-left hover:bg-transparent disabled:opacity-100" onClick={() => setOpen((v) => !v)}>
          <div className="w-full">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold leading-tight">
            {item.name}
            {(item.tags ?? []).map((t) => (
              <span key={t} className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                {tagLabel(t)}
              </span>
            ))}
            {hasDetail && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />}
          </p>
          <p className="text-xs text-muted-foreground">
            {showPrices && <span className="tabular font-semibold text-foreground">{formatEUR(Number(item.price))}</span>}
            {item.allergens.length > 0 && <span>{showPrices ? " · " : ""}{item.allergens.map(allergenLabel).join(", ")}</span>}
          </p>
          </div>
        </Button>
        <div className="flex shrink-0 items-center gap-2">
          {qty > 0 && (
            <Button variant="outline" size="icon" onClick={() => onQty(-1)} aria-label={`Quitar uno de ${item.name}`} className="h-9 w-9">
              <Minus className="h-4 w-4" />
            </Button>
          )}
          {qty > 0 && <span className="tabular w-4 text-center font-bold">{qty}</span>}
          <Button size="icon" onClick={() => onQty(1)} aria-label={`Añadir ${item.name}`} className="h-9 w-9">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-2 flex gap-3 pl-8">
          {image && <img src={image} alt={item.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
          <div className="text-sm text-muted-foreground">
            {item.description && <p>{item.description}</p>}
            {item.allergens.length > 0 && <p className="mt-1 text-xs">Alérgenos: {item.allergens.map(allergenLabel).join(", ")}</p>}
          </div>
        </div>
      )}
      {qty > 0 && (
        <Input className="mt-2" placeholder="Nota: sin cebolla, poco hecho…" value={note} onChange={(e) => onNote(e.target.value)} />
      )}
    </article>
  );
}
