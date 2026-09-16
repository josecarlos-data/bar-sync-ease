import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, Minus, Plus, Receipt, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { joinTable } from "@/lib/bar.functions";
import { useRealtime } from "@/hooks/useRealtime";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { useItemImages, resolveImage } from "@/lib/images";
import { allergenLabel, formatEUR } from "@/lib/allergens";
import { Input } from "@/components/ui/input";
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
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<"loading" | "nickname" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [tableInfo, setTableInfo] = useState<{ number: number; name: string | null } | null>(null);
  const [session, setSession] = useState<Joined | null>(null);
  const [nickname, setNickname] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<"carta" | "cuenta">("carta");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  async function attempt(nick?: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setMessage("No se pudo abrir la mesa. Vuelve a escanear el QR.");
        setPhase("error");
        return;
      }
    }
    const result = (await join({ data: nick ? { token, nickname: nick } : { token } })) as
      | Joined
      | { error: string }
      | { needsNickname: true; table: { number: number; name: string | null } };

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
    setSession(result);
    setTableInfo(result.table);
    setPhase("ready");
  }

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useRealtime("guest", ["order_items", "orders", "table_sessions"], !!session);

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
          "id, created_at, order_items(id, name_snapshot, price_snapshot, qty, note, status, deleted_at)",
        )
        .eq("session_id", session!.sessionId)
        .order("created_at");
      return (data ?? []) as {
        id: string;
        created_at: string;
        order_items: {
          id: string;
          name_snapshot: string;
          price_snapshot: number;
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
      toast.success("¡Tu pedido está listo!");
    }
  }, [bill]);

  const items = menu?.items ?? [];
  const settings = menu?.settings;
  const showPrices = settings?.show_prices ?? true;
  const { data: imageMap } = useItemImages(items.map((i) => i.image_url));

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const item = items.find((i) => i.id === line.itemId);
        return sum + (item ? Number(item.price) * line.qty : 0);
      }, 0),
    [cart, items],
  );

  const billTotal = (bill ?? [])
    .flatMap((o) => o.order_items)
    .filter((l) => !l.deleted_at)
    .reduce((sum, l) => sum + Number(l.price_snapshot) * l.qty, 0);

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

    const lines = cart.map((line) => {
      const item = items.find((i) => i.id === line.itemId)!;
      return {
        bar_id: session.barId,
        order_id: order.id,
        item_id: item.id,
        name_snapshot: item.name,
        price_snapshot: item.price,
        tax_rate_snapshot: item.tax_rate,
        qty: line.qty,
        note: line.note.trim() || null,
        destination: item.destination,
      };
    });

    const { error: lineError } = await supabase.from("order_items").insert(lines);
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
    return <Centered>{message}</Centered>;
  }

  if (phase === "nickname") {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-4 text-left">
          <h1 className="font-display text-2xl font-extrabold">
            Mesa {tableInfo?.number} · ¡Bienvenidos!
          </h1>
          <p className="text-sm text-muted-foreground">
            Ponle un nombre a vuestro grupo para que el camarero os identifique.
          </p>
          <Input
            placeholder={`Mesa ${tableInfo?.number ?? ""} - Ayuntamiento`}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button
            onClick={() => nickname.trim() && attempt(nickname.trim())}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
          >
            Entrar
          </button>
        </div>
      </Centered>
    );
  }

  const available = items.filter((i) => i.available);
  const soldOut = items.filter((i) => !i.available);
  const blocked = session?.status === "pending";

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display truncate text-lg font-extrabold">
              Mesa {tableInfo?.number}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{session?.nickname}</p>
          </div>
          <ConnectionBadge />
        </div>
        <div className="mt-2 flex gap-1">
          {(
            [
              ["carta", "Carta"],
              ["cuenta", "Cuenta"],
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
      </header>

      {blocked && (
        <p className="m-4 rounded-lg bg-warning px-4 py-3 text-sm font-semibold text-warning-foreground">
          Esperando a que el personal acepte vuestra mesa. Podéis ir mirando la carta.
        </p>
      )}

      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        {tab === "carta" && (
          <div className="space-y-6">
            {(menu?.categories ?? []).map((cat) => {
              const catItems = available.filter((i) => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <section key={cat.id}>
                  <h2 className="font-display mb-2 text-xl font-bold">{cat.name}</h2>
                  <div className="space-y-2">
                    {catItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        image={resolveImage(item.image_url, imageMap)}
                        showPrices={showPrices}
                        qty={cart.find((l) => l.itemId === item.id)?.qty ?? 0}
                        note={cart.find((l) => l.itemId === item.id)?.note ?? ""}
                        onQty={(delta) => changeQty(item.id, delta)}
                        onNote={(note) =>
                          setCart((prev) =>
                            prev.map((l) => (l.itemId === item.id ? { ...l, note } : l)),
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {soldOut.length > 0 && (
              <section className="rounded-xl bg-muted p-3">
                <h2 className="font-display mb-2 text-lg font-bold text-muted-foreground">
                  Agotados
                </h2>
                <ul className="space-y-1">
                  {soldOut.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between text-sm text-muted-foreground"
                    >
                      <span className="line-through">{item.name}</span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold">
                        Agotado
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "cuenta" && (
          <div className="space-y-4">
            {(bill ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no habéis pedido nada.</p>
            )}
            {(bill ?? []).map((order, index) => (
              <article key={order.id} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-sm font-bold text-muted-foreground">
                  Comanda {index + 1} ·{" "}
                  {new Date(order.created_at).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <ul className="space-y-1">
                  {order.order_items
                    .filter((l) => !l.deleted_at)
                    .map((line) => (
                      <li key={line.id} className="flex justify-between gap-2 text-sm">
                        <span>
                          {line.qty} × {line.name_snapshot}
                          {line.status === "ready" && (
                            <span className="ml-2 text-xs font-bold text-success">Listo</span>
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
            <p className="text-xs text-muted-foreground">
              ¿Algo está mal en la cuenta? Avisa al camarero: es quien puede corregir las comandas
              ya enviadas.
            </p>
          </div>
        )}
      </main>

      {tab === "carta" && cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-4">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {cart.reduce((n, l) => n + l.qty, 0)} artículos
              </p>
              {showPrices && (
                <p className="tabular font-display text-lg font-extrabold">
                  {formatEUR(cartTotal)}
                </p>
              )}
            </div>
            <button
              disabled={blocked}
              onClick={() => setConfirming(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              <UtensilsCrossed className="h-4 w-4" /> Enviar comanda
            </button>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Enviamos la comanda?</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {cart.map((line) => {
              const item = items.find((i) => i.id === line.itemId);
              return (
                <li key={line.itemId} className="flex justify-between gap-2">
                  <span>
                    {line.qty} × {item?.name}
                    {line.note && (
                      <span className="block text-xs text-muted-foreground italic">
                        {line.note}
                      </span>
                    )}
                  </span>
                  {showPrices && item && (
                    <span className="tabular">{formatEUR(Number(item.price) * line.qty)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <DialogFooter className="gap-2">
            <button
              onClick={() => {
                setCart([]);
                setConfirming(false);
              }}
              className="rounded-lg border border-border px-4 py-3 font-semibold"
            >
              Eliminar comanda
            </button>
            <button
              onClick={sendOrder}
              disabled={sending}
              className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Confirmar y enviar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemRow({
  item,
  image,
  showPrices,
  qty,
  note,
  onQty,
  onNote,
}: {
  item: Item;
  image: string | null;
  showPrices: boolean;
  qty: number;
  note: string;
  onQty: (delta: number) => void;
  onNote: (note: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <div className="flex gap-3">
        {image && (
          <img
            src={image}
            alt={item.name}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.name}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}
          {item.allergens.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Alérgenos: {item.allergens.map(allergenLabel).join(", ")}
            </p>
          )}
          {showPrices && (
            <p className="tabular mt-1 font-semibold">{formatEUR(Number(item.price))}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-center">
          {qty > 0 && (
            <button
              onClick={() => onQty(-1)}
              aria-label={`Quitar uno de ${item.name}`}
              className="rounded-md border border-border p-2"
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
          {qty > 0 && <span className="tabular w-4 text-center font-bold">{qty}</span>}
          <button
            onClick={() => onQty(1)}
            aria-label={`Añadir ${item.name}`}
            className="rounded-md bg-primary p-2 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {qty > 0 && (
        <Input
          className="mt-2"
          placeholder="Nota: sin cebolla, poco hecho…"
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      )}
    </article>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-muted-foreground">
      {children}
    </div>
  );
}
