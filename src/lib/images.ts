import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Las imágenes se guardan en un almacén privado: generamos enlaces firmados
 * temporales para mostrarlas. Si el valor ya es una URL pública, se usa tal cual.
 */
export function useItemImages(paths: (string | null | undefined)[]) {
  const storagePaths = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];

  return useQuery({
    queryKey: ["item-images", storagePaths.join("|")],
    enabled: storagePaths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("item-images")
        .createSignedUrls(storagePaths, 3600);
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
  });
}

export function resolveImage(
  value: string | null | undefined,
  map: Record<string, string> | undefined,
): string | null {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return map?.[value] ?? null;
}
