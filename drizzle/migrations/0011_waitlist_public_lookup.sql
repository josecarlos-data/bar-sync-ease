-- Ficha pública mínima para la página de apuntarse a la lista de espera.
-- Solo devuelve lo justo (identificador, nombre y si la lista está activa)
-- y únicamente cuando el bar tiene la lista de espera encendida.
CREATE OR REPLACE FUNCTION public.waitlist_bar_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'waitlist_enabled', s.waitlist_enabled,
    'hours_enabled', s.hours_enabled,
    'hours', s.hours,
    'timezone', s.timezone,
    'special_enabled', s.special_enabled,
    'special_text', s.special_text
  )
  FROM public.bars b
  JOIN public.bar_settings s ON s.bar_id = b.id
  WHERE b.slug = _slug AND s.waitlist_enabled
$function$;

REVOKE ALL ON FUNCTION public.waitlist_bar_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_bar_by_slug(text) TO anon, authenticated;
