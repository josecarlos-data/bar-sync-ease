import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openStatus, parseHours, type WeekHours } from "@/lib/hours";

type Search = { bar?: string | undefined };

export const Route = createFileRoute("/apuntarse")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = search["bar"];
    return { bar: typeof raw === "string" ? raw : undefined };
  },
  head: () => ({
    meta: [
      { title: "Apuntarse a la lista de espera — Comandas de bar" },
      {
        name: "description",
        content: "Deja tu nombre y cuántos sois y el bar os llama cuando quede sitio.",
      },
      { property: "og:title", content: "Lista de espera" },
      { property: "og:description", content: "Apúntate y te llamamos cuando quede sitio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WaitlistJoin,
});

type BarInfo = {
  id: string;
  name: string;
  waitlist_enabled: boolean;
  hours_enabled: boolean;
  hours: WeekHours | null;
  timezone: string;
};

function WaitlistJoin() {
  const { bar: slug } = useSearch({ from: "/apuntarse" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState(2);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist-bar", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: d } = await supabase.rpc("waitlist_bar_by_slug", { _slug: slug! });
      return (d ?? null) as BarInfo | null;
    },
  });

  async function join() {
    if (!data) return;
    const clean = name.trim();
    if (!clean) { toast.error("Escribe tu nombre"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("join_waitlist", {
      _bar: data.id,
      _name: clean,
      _phone: phone.trim(),
      _people: people,
    });
    setBusy(false);
    if (error) {
      toast.error("No hemos podido apuntarte. Avisa a alguien del bar.");
      return;
    }
    setDone(clean);
  }

  if (!slug) {
    return (
      <Shell>
        <p>Esta página va sin enlace. Pide en la barra el código de la lista de espera o escanea el QR de una mesa.</p>
      </Shell>
    );
  }

  if (isLoading) {
    return <Shell>Cargando…</Shell>;
  }

  if (!data?.waitlist_enabled) {
    return (
      <Shell>
        <p>Este bar no tiene lista de espera ahora mismo. Avisa a alguien del bar y te dice.</p>
      </Shell>
    );
  }

  const status = data.hours_enabled ? openStatus(parseHours(data.hours), data.timezone) : null;

  if (done) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-extrabold">Apuntados, {done}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sois {people} {people === 1 ? "persona" : "personas"}. Os llamamos al número que has dejado cuando quede sitio.
        </p>
        {status && !status.open && <p className="mt-3 text-sm text-muted-foreground">{status.text}</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-extrabold">Lista de espera · {data.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Deja tu nombre y cuántos sois. El bar os llama cuando quede sitio.
      </p>
      {status && !status.open && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm">
          <Clock className="h-4 w-4" /> {status.text}
        </p>
      )}

      <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void join(); }}>
        <Input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Personas</span>
          <Input
            type="number"
            min={1}
            max={20}
            className="w-20"
            value={people}
            onChange={(e) => setPeople(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
        <Input placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Apuntando…" : "Apuntarme"}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 py-10">{children}</div>
    </div>
  );
}
