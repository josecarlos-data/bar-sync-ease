import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

export function ConnectionBadge({ pending = 0, syncing = false }: { pending?: number; syncing?: boolean }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const label = !online
    ? pending > 0
      ? `Sin conexión · ${pending} pendiente${pending === 1 ? "" : "s"}`
      : "Sin conexión"
    : syncing
      ? "Sincronizando…"
      : pending > 0
        ? `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`
        : "En línea";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        !online
          ? "bg-destructive/15 text-destructive"
          : syncing || pending > 0
            ? "bg-warning/15 text-warning-foreground"
            : "bg-success/15 text-success"
      }`}
    >
      {!online ? (
        <WifiOff className="h-3 w-3" />
      ) : syncing || pending > 0 ? (
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}
