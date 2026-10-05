import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { onQueueChanged, pendingCount, syncQueue } from "@/lib/offline";

/**
 * Estado de conexión + sincronización de la cola offline de un bar.
 * Solo actúa si el bar tiene el modo sin conexión activado en Ajustes.
 */
export function useOffline(barId: string | null, enabled: boolean) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!barId) return;
    const refresh = () => setPending(pendingCount(barId));
    refresh();
    const off = onQueueChanged(refresh);
    const t = setInterval(refresh, 5000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [barId]);

  useEffect(() => {
    if (!barId || !enabled || !online) return;
    let cancelled = false;
    const run = async () => {
      if (!pendingCount(barId)) return;
      setSyncing(true);
      try {
        const res = await syncQueue(barId);
        if (cancelled) return;
        if (res.synced > 0) {
          toast.success(
            res.synced === 1
              ? "1 cambio sin conexión sincronizado"
              : `${res.synced} cambios sin conexión sincronizados`,
          );
          queryClient.invalidateQueries();
        }
        for (const f of res.failed) {
          toast.error(`No se pudo sincronizar: ${f.label}. ${f.reason}`);
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };
    run();
    const t = setInterval(run, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [barId, enabled, online, queryClient]);

  return { online, offline: enabled && !online, pending, syncing };
}
