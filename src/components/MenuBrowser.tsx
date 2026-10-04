import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Heart, Minus, Plus, Search, X } from "lucide-react";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { buildSections, tagLabel } from "@/lib/menu";
import { Input } from "@/components/ui/input";
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
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"group" | "alpha">("group");
  const [exclude, setExclude] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

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

  const available = filtered.filter((i) => i.available);
  const soldOut = filtered.filter((i) => !i.available);
  const sections = useMemo(() => buildSections(categories, available, sort), [categories, available, sort]);
  const favItems = items.filter((i) => favs.includes(i.id));

  // Sección activa al hacer scroll
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sec-${s.category.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("sec-", ""));
      },
      { rootMargin: "-160px 0px -60% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!active) return;
    navRef.current?.querySelector(`[data-cat="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

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
              <button aria-label="Borrar búsqueda" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSort(sort === "group" ? "alpha" : "group")}
            className="rounded-md border border-border px-3 text-xs font-semibold"
          >
            {sort === "group" ? "Por grupo" : "A-Z"}
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded-md border px-3 text-xs font-semibold ${exclude.length ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            Alérgenos{exclude.length ? ` (${exclude.length})` : ""}
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((a) => {
              const on = exclude.includes(a);
              return (
                <button
                  key={a}
                  onClick={() => setExclude((p) => (on ? p.filter((x) => x !== a) : [...p, a]))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  Sin {allergenLabel(a).toLowerCase()}
                </button>
              );
            })}
          </div>
        )}
        <div ref={navRef} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {favItems.length > 0 && (
            <button
              onClick={() => document.getElementById("sec-favs")?.scrollIntoView({ behavior: "smooth" })}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold"
            >
              <Heart className="h-3.5 w-3.5 fill-current text-destructive" /> {favItems.length}
            </button>
          )}
          {sections.map((s) => (
            <button
              key={s.category.id}
              data-cat={s.category.id}
              onClick={() => document.getElementById(`sec-${s.category.id}`)?.scrollIntoView({ behavior: "smooth" })}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                active === s.category.id ? "bg-foreground text-background" : "border border-border text-muted-foreground"
              }`}
            >
              {s.category.name}
            </button>
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
  const hasDetail = !!(item.description || item.allergens.length || image);
  return (
    <article className={`rounded-xl border bg-card p-3 ${qty > 0 ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <button
          aria-label={fav ? `Quitar ${item.name} de favoritas` : `Marcar ${item.name} como favorita`}
          onClick={onFav}
          className="shrink-0 p-1"
        >
          <Heart className={`h-5 w-5 ${fav ? "fill-current text-destructive" : "text-muted-foreground"}`} />
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => hasDetail && setOpen((v) => !v)}>
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
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {qty > 0 && (
            <button onClick={() => onQty(-1)} aria-label={`Quitar uno de ${item.name}`} className="rounded-md border border-border p-2">
              <Minus className="h-4 w-4" />
            </button>
          )}
          {qty > 0 && <span className="tabular w-4 text-center font-bold">{qty}</span>}
          <button onClick={() => onQty(1)} aria-label={`Añadir ${item.name}`} className="rounded-md bg-primary p-2 text-primary-foreground">
            <Plus className="h-4 w-4" />
          </button>
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
