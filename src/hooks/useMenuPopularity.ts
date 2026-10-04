import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Unidades vendidas por artículo en los últimos 30 días (solo agregados). */
export function useMenuPopularity(barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["menu-popularity", barId],
    enabled: !!barId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("menu_popularity", { _bar_id: barId ?? "" });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.item_id, Number(row.units)])) as Record<string, number>;
    },
  });
}
