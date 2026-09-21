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
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ensureProfile = useServerFn(ensureStaffProfile);
  const resolve = useServerFn(resolveLogin);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && !data.user.is_anonymous) navigate({ to: "/camarero", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const resolved = await resolve({ data: { login: login.trim() } });
      if (resolved.inactive) {
        toast.error("Esta cuenta está desactivada. Habla con el administrador.");
        return;
      }
      if (!resolved.email) {
        toast.error("Usuario o contraseña incorrectos");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password,
      });
      if (error) {
        toast.error("Usuario o contraseña incorrectos");
        return;
      }
      await ensureProfile({ data: {} });
      navigate({ to: "/camarero", replace: true });
    } catch {
      toast.error("No se pudo entrar");
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
        <h1 className="mt-4 font-display text-3xl font-bold">Acceso del personal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entra con tu usuario o tu correo. Las cuentas las crea el administrador del bar.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login">Usuario o correo</Label>
            <Input
              id="login"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}

