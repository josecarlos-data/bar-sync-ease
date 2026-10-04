import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Se suscribe a cambios en las tablas indicadas y refresca las consultas. */
export function useRealtime(channelName: string, tables: string[], enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    // Nombre único por instancia: supabase reutiliza canales con el mismo nombre
    // y fallaría al añadir callbacks a un canal ya suscrito.
    const channel = supabase.channel(`${channelName}:${Math.random().toString(36).slice(2, 10)}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries();
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, tables.join(","), queryClient]);
}

export function useOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
