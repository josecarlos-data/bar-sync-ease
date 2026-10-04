import { cartDrinks, houseTapaLines, priceCart, pricedTotal, proposeRounds, tapaMode } from "@/lib/tapas";
import { displayNickname } from "@/lib/tableLabel";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, FileText, Minus, Plus, Receipt, UtensilsCrossed } from "lucide-react";
import { LiveTicket } from "@/components/LiveTicket";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { supabase } from "@/integrations/supabase/client";
import { joinTable, reportOccupied } from "@/lib/bar.functions";
import { useRealtime } from "@/hooks/useRealtime";
import { MenuBrowser } from "@/components/MenuBrowser";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { SplitBill, type SplitLine } from "@/components/SplitBill";
import { useItemImages, resolveImage } from "@/lib/images";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { openStatus, parseHours } from "@/lib/hours";
import { detectLang, rememberLang, storedLang, t, type Lang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { BarSettings, Category, Item, LineStatus } from "@/lib/types";

export const Route = createFileRoute("/m/$token")({
  head: () => ({
    meta: [
      { title: "Pide desde tu mesa" },
      { name: "description", content: "Consulta la carta y envía tu comanda desde el móvil." },
      { property: "og:title", content: "Pide desde tu mesa" },
      { property: "og:description", content: "Consulta la carta y envía tu comanda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestPage,
});

type Joined = {
  sessionId: string;
  barId: string;
  status: "pending" | "open" | "rejected";
  nickname: string | null;
  table: { number: number; name: string | null };
};

type CartLine = { itemId: string; qty: number; note: string };

function GuestPage() {
  const { token } = Route.useParams();
  const join = useServerFn(joinTable);
  const report = useServerFn(reportOccupied);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<"loading" | "nickname" | "ready" | "error" | "occupied" | "notice">("loading");
  const [occupied, setOccupied] = useState<{
    nickname: string | null;
    openedAt: string | null;
    orderCount: number;
    barId: string;
    slug: string;
    waitlistEnabled: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [tableInfo, setTableInfo] = useState<{ number: number; name: string | null } | null>(null);
  const [session, setSession] = useState<Joined | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [nickname, setNickname] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<"carta" | "cuenta" | "ticket">("carta");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  async function attempt(nick?: string, confirmJoin?: boolean, skipNickname?: boolean) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("[mesa] signInAnonymously falló:", error);
          setMessage("No hemos podido conectar. Inténtalo de nuevo.");
          setPhase("error");
          return;
        }
      }
      const result = (await join({ data: { token, ...(nick ? { nickname: nick } : {}), ...(confirmJoin ? { confirmJoin: true } : {}), ...(skipNickname ? { skipNickname: true } : {}) } })) as
        | Joined
        | { error: string }
        | { needsNickname: true; table: { number: number; name: string | null } }
        | {
            alreadyOpen: {
              nickname: string | null;
              openedAt: string | null;
              orderCount: number;
              barId: string;
              slug: string;
              waitlistEnabled: boolean;
            };
            table: { number: number; name: string | null };
          };

      if ("error" in result) {
        setMessage(result.error);
        setPhase("error");
        return;
      }
      if ("needsNickname" in result) {
        setTableInfo(result.table);
        setPhase("nickname");
        return;
      }
      if ("alreadyOpen" in result) {
        setTableInfo(result.table);
        setOccupied(result.alreadyOpen);
        setPhase("occupied");
        return;
      }
      setSession(result);
      setTableInfo(result.table);
      setPhase("ready");
    } catch (e) {
      console.error("[mesa] error al abrir la mesa:", e);
      setMessage("No hemos podido conectar. Inténtalo de nuevo.");
      setPhase("error");
    }
  }

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useRealtime("guest", ["order_items", "orders", "table_sessions", "bill_splits", "bill_split_parts", "bill_split_assignments"], !!session);

  const { data: menu } = useQuery({
    queryKey: ["guest-menu", session?.barId],
    enabled: !!session,
    queryFn: async () => {
      const [cats, items, settings] = await Promise.all([
        supabase.from("categories").select("*").eq("bar_id", session!.barId).order("position"),
        supabase.from("items").select("*").eq("bar_id", session!.barId).order("position"),
        supabase.from("bar_settings").select("*").eq("bar_id", session!.barId).maybeSingle(),
      ]);
      return {
        categories: (cats.data ?? []) as Category[],
        items: (items.data ?? []) as Item[],
        settings: (settings.data ?? null) as BarSettings | null,
      };
    },
  });

  const { data: tr } = useQuery({
    queryKey: ["guest-translations", session?.barId, lang],
    enabled: !!session && lang !== "es",
    queryFn: async () => {
      const [it, ct] = await Promise.all([
        supabase
          .from("item_translations")
          .select("item_id, name, description")
          .eq("bar_id", session!.barId)
          .eq("lang", lang),
        supabase
          .from("category_translations")
          .select("category_id, name")
          .eq("bar_id", session!.barId)
          .eq("lang", lang),
      ]);
      return { items: it.data ?? [], cats: ct.data ?? [] };
    },
  });

  useEffect(() => {
    const avail = (menu?.settings?.menu_languages ?? ["es"]) as string[];
    if (avail.length < 2) {
      setLang("es");
      return;
    }
    setLang(storedLang(avail) ?? detectLang(avail));
  }, [menu?.settings?.menu_languages]);

  const { data: liveStatus } = useQuery({
    queryKey: ["guest-session-status", session?.sessionId],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("table_sessions")
        .select("status")
        .eq("id", session!.sessionId)
        .maybeSingle();
      return (data?.status ?? session!.status) as "pending" | "open" | "rejected" | "closed";
    },
  });

  const { data: bill } = useQuery({
    queryKey: ["guest-bill", session?.sessionId],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, created_at, created_by_role, order_items(id, item_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note, status, deleted_at, tapa_kind, tapa_round)",
        )
        .eq("session_id", session!.sessionId)
        .order("created_at");
      return (data ?? []) as {
        id: string;
        created_at: string;
        created_by_role: string;
        order_items: {
          id: string;
          item_id: string | null;
          tapa_kind: string | null;
          tapa_round: number | null;
          name_snapshot: string;
          price_snapshot: number;
          tax_rate_snapshot: number;
          qty: number;
          note: string | null;
          status: LineStatus;
          deleted_at: string | null;
        }[];
      }[];
    },
  });

  // Aviso cuando algo del pedido está listo
  const readySeen = useRef<Set<string>>(new Set());
  const firstBill = useRef(true);
  useEffect(() => {
    if (!bill) return;
    const readyIds = bill
      .flatMap((o) => o.order_items)
      .filter((l) => !l.deleted_at && l.status === "ready")
      .map((l) => l.id);
    if (firstBill.current) {
      readyIds.forEach((id) => readySeen.current.add(id));
      firstBill.current = false;
      return;
    }
    const fresh = readyIds.filter((id) => !readySeen.current.has(id));
    if (fresh.length > 0) {
      fresh.forEach((id) => readySeen.current.add(id));
      toast.success(t("readyToast", lang));
    }
  }, [bill]);

  const items = menu?.items ?? [];
  const shownItems = useMemo(() => {
    if (lang === "es" || !tr) return items;
    return items.map((i) => {
      const x = tr.items.find((v) => v.item_id === i.id);
      return x ? { ...i, name: x.name, description: x.description ?? i.description } : i;
    });
  }, [items, tr, lang]);
  const shownCategories = useMemo(() => {
    if (lang === "es" || !tr) return menu?.categories ?? [];
    return (menu?.categories ?? []).map((c) => {
      const x = tr.cats.find((v) => v.category_id === c.id);
      return x ? { ...c, name: x.name } : c;
    });
  }, [menu, tr, lang]);
  const settings = menu?.settings;
  const showPrices = settings?.show_prices ?? true;
  const { data: imageMap } = useItemImages(items.map((i) => i.image_url));

  const tmode = tapaMode(settings);
  const sessionTapaLines = useMemo(() => (bill ?? []).flatMap((o) => o.order_items), [bill]);
  const priced = useMemo(() => priceCart(settings, cart, items, sessionTapaLines), [settings, cart, items, sessionTapaLines]);
  const houseLines = useMemo(() => {
    if (tmode !== "house") return [];
    const n = cartDrinks(cart, items);
    return houseTapaLines(settings, proposeRounds(n, sessionTapaLines), n);
  }, [tmode, settings, cart, items, sessionTapaLines]);
  const cartTotal = pricedTotal(priced);

  const billLines: SplitLine[] = (bill ?? [])
    .flatMap((o) => o.order_items)
    .filter((l) => !l.deleted_at)
    .map((l) => ({
      id: l.id,
      name: l.name_snapshot,
      price: Number(l.price_snapshot),
      qty: l.qty,
    }));

  const billTotal = billLines.reduce((sum, l) => sum + l.price * l.qty, 0);

  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === itemId);
      if (!existing) return delta > 0 ? [...prev, { itemId, qty: 1, note: "" }] : prev;
      const qty = existing.qty + delta;
      if (qty <= 0) return prev.filter((l) => l.itemId !== itemId);
      return prev.map((l) => (l.itemId === itemId ? { ...l, qty } : l));
    });
  }

  async function sendOrder() {
    if (!session || cart.length === 0) return;
    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        bar_id: session.barId,
        session_id: session.sessionId,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !order) {
      setSending(false);
      toast.error("No se pudo enviar la comanda");
      return;
    }

    const lines: Record<string, unknown>[] = priced.map((line) => {
      const item = line.item;
      return {
        bar_id: session.barId,
        order_id: order.id,
        item_id: item.id,
        name_snapshot: item.name,
        price_snapshot: line.price,
        tax_rate_snapshot: item.tax_rate,
        qty: line.qty,
        note: line.note.trim() || null,
        destination: item.destination,
        tapa_kind: line.tapa_kind,
      };
    });
    for (const h of houseLines) {
      lines.push({
        bar_id: session.barId,
        order_id: order.id,
        item_id: null,
        name_snapshot: h.name,
        price_snapshot: h.price,
        tax_rate_snapshot: 10,
        qty: h.qty,
        note: null,
        destination: "kitchen",
        tapa_kind: h.tapa_kind,
        tapa_round: h.tapa_round,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lineError } = await supabase.from("order_items").insert(lines as any);
    setSending(false);
    setConfirming(false);
    if (lineError) {
      toast.error("No se pudo enviar la comanda");
      return;
    }
    setCart([]);
    toast.success("Comanda enviada");
    queryClient.invalidateQueries();
  }

  async function call(type: "waiter" | "bill") {
    if (!session) return;
    const { error } = await supabase.from("service_calls").insert({
      bar_id: session.barId,
      session_id: session.sessionId,
      type,
    });
    if (error) { toast.error("No se pudo avisar al camarero"); return; }
    toast.success(type === "bill" ? "Hemos pedido la cuenta" : "Avisamos al camarero");
  }

  if (phase === "loading") {
    return <Centered>Abriendo tu mesa…</Centered>;
  }

  if (phase === "error") {
    return (
      <Centered>
        <div className="space-y-4">
          <p>{message}</p>
          <Button onClick={() => { setPhase("loading"); attempt(); }}>Reintentar</Button>
        </div>
      </Centered>
    );
  }

  if (phase === "occupied" && occupied) {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-4 text-left">
          <h1 className="font-display text-2xl font-extrabold">Esta mesa ya está abierta</h1>
          <p className="text-sm text-muted-foreground">
            Mesa {tableInfo?.number}
            {occupied.nickname ? ` · abierta por "${occupied.nickname}"` : ""}
            {occupied.openedAt
              ? ` ${t("at", lang)} ${new Date(occupied.openedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
            {` · ${occupied.orderCount} ${occupied.orderCount === 1 ? t("orderOne", lang) : t("orderMany", lang)}`}
          </p>
          <Button className="w-full" onClick={() => { setPhase("loading"); attempt(undefined, true); }}>
            {t("sameGroup", lang)}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await report({ data: { token } }).catch(() => {});
              setMessage(t("tableOpenNotice", lang));
              setPhase("notice");
            }}
          >
            {t("otherClients", lang)}
          </Button>
          {occupied.waitlistEnabled && <OccupiedWaitlist barId={occupied.barId} slug={occupied.slug} lang={lang} />}
        </div>
      </Centered>
    );
  }

  if (phase === "notice") {
    return <Centered>{message}</Centered>;
  }

  if (phase === "nickname") {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-4 text-left">
          <h1 className="font-display text-2xl font-extrabold">
            {t("tableWord", lang)} {tableInfo?.number} · {t("welcome", lang)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("nicknameAsk", lang)} {t("orAs", lang)} «{t("tableWord", lang)} {tableInfo?.number}».
          </p>
          <Input
            placeholder={`${t("tableWord", lang)} ${tableInfo?.number ?? ""}`}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                attempt(nickname.trim() || undefined, false, true);
            }}
          />
          <button
            onClick={() =>
              attempt(nickname.trim() || undefined, false, true)
            }
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
          >
            {t("enterWord", lang)}
          </button>
        </div>
      </Centered>
    );
  }

  const available = items.filter((i) => i.available);
  const soldOut = items.filter((i) => !i.available);
  const status = liveStatus ?? session?.status ?? "open";
  const awaiting = status === "pending";

  if (status === "rejected") {
    return (
      <Centered>
        <div className="max-w-sm space-y-2">
          <h1 className="font-display text-2xl font-extrabold">{t("rejectedTitle", lang)}</h1>
          <p className="text-muted-foreground">{t("rejectedText", lang)}</p>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display truncate text-lg font-extrabold">
              {t("tableWord", lang)} {tableInfo?.number}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{displayNickname(session?.nickname, tableInfo?.number)}</p>
          </div>
          <ConnectionBadge />
        </div>
        <div className="mt-2 flex gap-1">
          {(
            [
              ["carta", t("tabCarta", lang)],
              ["cuenta", t("tabBill", lang)],
              ...(showPrices ? ([["ticket", t("tabTicket", lang)]] as const) : []),
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(menu?.settings?.menu_languages ?? ["es"]).length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(menu?.settings?.menu_languages ?? ["es"]).map((code) => (
              <button
                key={code}
                onClick={() => {
                  const next = code as Lang;
                  setLang(next);
                  rememberLang(next);
                }}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${
                  lang === code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        )}
      </header>

      {awaiting && (
        <p className="m-4 rounded-lg bg-warning px-4 py-3 text-sm font-semibold text-warning-foreground">
          {t("awaiting", lang)}
        </p>
      )}

      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        {tab === "carta" && (
          <div className="space-y-4">
            {menu?.settings && (
              <>
                {menu.settings.hours_enabled && <HoursBanner settings={menu.settings} lang={lang} />}
                {menu.settings.special_enabled && (
                  <SpecialCard
                    settings={menu.settings}
                    items={shownItems}
                    lang={lang}
                    showPrices={showPrices}
                    image={(item) => resolveImage(item.image_url, imageMap)}
                  />
                )}
              </>
            )}
            <MenuBrowser
              categories={shownCategories}
              sort={menu?.settings?.menu_sort ?? "alpha"}
              items={shownItems}
              lang={lang}
              cart={cart}
              showPrices={showPrices}
              favKey={`comandas:favs:${session?.sessionId ?? ""}`}
              images={(item) => resolveImage(item.image_url, imageMap)}
              stickyTop="top-[105px]"
              showSoldOut={menu?.settings?.show_sold_out_notice !== false}
              tapaChoice={tmode === "choice"}
              onQty={changeQty}
              onNote={(itemId, note) => setCart((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)))}
            />
          </div>
        )}

        {tab === "cuenta" && (
          <div className="space-y-4">
            {(bill ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{t("emptyBill", lang)}</p>
            )}
            {(bill ?? []).map((order, index) => (
              <article key={order.id} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-sm font-bold text-muted-foreground">
                  {awaiting && (
                    <span className="mb-1 block w-fit rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
                      {t("pendingConfirm", lang)}
                    </span>
                  )}
                  {t("orderWord", lang)} {index + 1} ·{" "}
                  {new Date(order.created_at).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {order.created_by_role !== "client" && ` · ${t("addedBy", lang)}`}
                </p>
                <ul className="space-y-1">
                  {order.order_items
                    .filter((l) => !l.deleted_at)
                    .map((line) => (
                      <li key={line.id} className="flex justify-between gap-2 text-sm">
                        <span>
                          {line.qty} × {line.name_snapshot}
                          {line.status === "preparing" && (
                            <span className="ml-2 text-xs font-bold text-warning-foreground">{t("preparing", lang)}</span>
                          )}
                          {line.status === "ready" && (
                            <span className="ml-2 text-xs font-bold text-success">Listo</span>
                          )}
                          {line.status === "served" && (
                            <span className="ml-2 text-xs font-bold text-muted-foreground">Servido</span>
                          )}
                          {line.note && (
                            <span className="block text-xs text-muted-foreground italic">
                              {line.note}
                            </span>
                          )}
                        </span>
                        {showPrices && (
                          <span className="tabular">
                            {formatEUR(Number(line.price_snapshot) * line.qty)}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </article>
            ))}

            {showPrices && (bill ?? []).length > 0 && (
              <div className="flex justify-between rounded-xl bg-secondary px-4 py-3 font-display text-xl font-extrabold">
                <span>Total</span>
                <span className="tabular">{formatEUR(billTotal)}</span>
              </div>
            )}

            {showPrices && billLines.length > 0 && liveStatus !== "rejected" && (
              <SplitBill
                sessionId={session!.sessionId}
                barId={session!.barId}
                lines={billLines}
                total={billTotal}
                paymentsEnabled={settings?.payments_enabled ?? false}
                onRequestWaiter={() => call("bill")}
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => call("waiter")}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-3 font-semibold"
              >
                <BellRing className="h-4 w-4" /> Llamar al camarero
              </button>
              <button
                onClick={() => call("bill")}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-foreground py-3 font-semibold text-background"
              >
                <Receipt className="h-4 w-4" /> Solicitar cuenta
              </button>
            </div>
            {showPrices && billLines.length > 0 && liveStatus !== "rejected" && (
              <ClientTicketButton sessionId={session!.sessionId} lang={lang} />
            )}
            <p className="text-xs text-muted-foreground">
              {t("billHelp", lang)}
            </p>
          </div>
        )}

        {tab === "ticket" && showPrices && (
          <LiveTicket
            sessionId={session!.sessionId}
            barName={t("ticketTitle", lang)}
            settings={settings}
            tableNumber={tableInfo?.number}
            nickname={session?.nickname}
            lines={liveStatus === "rejected" ? [] : (bill ?? []).flatMap((o) => o.order_items).filter((l) => !l.deleted_at).map((l) => ({ name: l.name_snapshot, price: Number(l.price_snapshot), qty: l.qty, taxRate: Number(l.tax_rate_snapshot ?? 10) }))}
          />
        )}
      </main>

      {tab === "carta" && cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-4">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {cart.reduce((n, l) => n + l.qty, 0)} {t("articlesWord", lang)}
              </p>
              {showPrices && (
                <p className="tabular font-display text-lg font-extrabold">
                  {formatEUR(cartTotal)}
                </p>
              )}
            </div>
            <button
              disabled={sending}
              onClick={() => setConfirming(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              <UtensilsCrossed className="h-4 w-4" /> {t("sendOrder", lang)}
            </button>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", lang)}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {priced.map((line, idx) => {
              const item = line.item;
              return (
                <li key={line.item.id + idx} className="flex justify-between gap-2">
                  <span>
                    {line.qty} × {shownItems.find((i) => i.id === item.id)?.name ?? item.name}
                    {line.tapa_kind && <span className="ml-1 text-xs font-bold text-primary">(tapa con bebida)</span>}
                    {line.note && (
                      <span className="block text-xs text-muted-foreground italic">
                        {line.note}
                      </span>
                    )}
                  </span>
                  {showPrices && item && (
                    <span className="tabular">{formatEUR(line.price * line.qty)}</span>
                  )}
                </li>
              );
            })}
            {houseLines.map((h) => (
              <li key={h.name} className="flex justify-between gap-2 text-primary">
                <span>{h.qty} × {h.name}</span>
                {showPrices && <span className="tabular">{h.price ? formatEUR(h.price * h.qty) : "0,00 €"}</span>}
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setCart([]);
                setConfirming(false);
              }}
              className="rounded-lg border border-border px-4 py-3 font-semibold"
            >
              {t("clearOrder", lang)}
            </button>
            <button
              onClick={sendOrder}
              disabled={sending}
              className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sending ? t("sendingWord", lang) : t("confirmSend", lang)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-muted-foreground">
      {children}
    </div>
  );
}

/** Quien espera mesa puede apuntarse sin salir de esta pantalla. */
function OccupiedWaitlist({ barId, slug, lang = "es" }: { barId: string; slug: string; lang?: Lang }) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function joinList() {
    const clean = name.trim();
    if (!clean) { toast.error(t("joinNameError", lang)); return; }
    setBusy(true);
    const { error } = await supabase.rpc("join_waitlist", {
      _bar: barId,
      _name: clean,
      _phone: phone.trim(),
      _people: people,
    });
    setBusy(false);
    if (error) { toast.error(t("joinFail", lang)); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-secondary p-3 text-sm">
        <p className="font-semibold">{t("joinedTitle", lang)}, {name.trim()}</p>
        <p className="text-muted-foreground">
          {people} {people === 1 ? t("personOne", lang) : t("personMany", lang)}. {t("joinedHint", lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-sm font-semibold">{t("waitlistAsk", lang)}</p>
      <div className="space-y-2">
        <Input placeholder={t("yourName", lang)} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("peopleWord", lang)}</span>
          <Input
            type="number"
            min={1}
            max={20}
            className="w-20"
            value={people}
            onChange={(e) => setPeople(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
        <Input placeholder={t("phoneOptional", lang)} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        <Button className="w-full" variant="outline" disabled={busy} onClick={joinList}>
          {busy ? t("joining", lang) : t("joinList", lang)}
        </Button>
        {slug && (
          <p className="text-xs text-muted-foreground">
            {t("noQr", lang)} /apuntarse?bar={slug}
          </p>
        )}
      </div>
    </div>
  );
}

/** Aviso de horario del bar: abierto, a punto de cerrar o cuándo abre. */
function HoursBanner({ settings, lang = "es" }: { settings: BarSettings; lang?: Lang }) {
  const status = openStatus(parseHours(settings.hours), settings.timezone ?? "Europe/Madrid", lang);
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        status.open ? "bg-secondary text-secondary-foreground" : "bg-warning px-4 py-3 text-warning-foreground"
      }`}
    >
      {status.text}
    </p>
  );
}

/** «Especial de hoy»: plato enlazado de la carta o texto suelto. */
function SpecialCard({
  settings,
  items,
  showPrices,
  image,
  lang = "es",
}: {
  settings: BarSettings;
  items: Item[];
  showPrices: boolean;
  image: (item: Item) => string | null;
  lang?: Lang;
}) {
  const item = settings.special_item_id ? items.find((i) => i.id === settings.special_item_id) : undefined;
  const text = settings.special_text?.trim() || item?.name || "";
  if (!text) return null;
  const src = item ? image(item) : null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      {src && <img src={src} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">{t("special", lang)}</p>
        <p className="font-semibold">{text}</p>
        {item && showPrices && <p className="text-sm text-muted-foreground">{formatEUR(Number(item.price))}</p>}
      </div>
    </div>
  );
}

function ClientTicketButton({ sessionId, lang = "es" }: { sessionId: string; lang?: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-border py-3 font-semibold"
      >
        <FileText className="h-4 w-4" /> {t("ticketPdf", lang)}
      </button>
      {open && <InvoiceDialog sessionId={sessionId} staff={false} onClose={() => setOpen(false)} />}
    </>
  );
}
