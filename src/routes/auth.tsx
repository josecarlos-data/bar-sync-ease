import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureStaffProfile } from "@/lib/bar.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso del personal — Comandas de bar" },
      {
        name: "description",
        content:
          "Entra como administrador, camarero, barra o cocina para gestionar las comandas del bar.",
      },
      { property: "og:title", content: "Acceso del personal — Comandas de bar" },
      {
        property: "og:description",
        content: "Entra para gestionar la carta, las mesas y las comandas en tiempo real.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ensureProfile = useServerFn(ensureStaffProfile);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && !data.user.is_anonymous) navigate({ to: "/camarero", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.info("Revisa tu correo para confirmar la cuenta.");
        return;
      }
      await ensureProfile({ data: fullName ? { fullName } : {} });
      navigate({ to: "/camarero", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="text-sm text-muted-foreground">
          ← Inicio
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">
          {mode === "login" ? "Acceso del personal" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La primera cuenta del bar se crea como administrador.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "No tengo cuenta" : "Ya tengo cuenta"}
        </button>
      </div>
    </div>
  );
}
