import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, BarSettings } from "@/lib/types";

export function useStaff() {
  return useQuery({
    queryKey: ["staff-context"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, bar_id")
        .eq("user_id", user.id);

      const barId = roles?.[0]?.bar_id ?? null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? null,
        barId,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export function useBarSettings(barId: string | null | undefined) {
  return useQuery({
    queryKey: ["bar-settings", barId],
    enabled: !!barId,
    queryFn: async () => {
      const { data } = await supabase
        .from("bar_settings")
        .select("*")
        .eq("bar_id", barId!)
        .maybeSingle();
      return (data ?? null) as BarSettings | null;
    },
  });
}
