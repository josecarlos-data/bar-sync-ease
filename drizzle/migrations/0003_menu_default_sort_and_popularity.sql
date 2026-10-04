ALTER TABLE public.bar_settings ADD COLUMN menu_sort text NOT NULL DEFAULT 'alpha' CHECK (menu_sort IN ('alpha', 'popular', 'manual'));

CREATE OR REPLACE FUNCTION public.menu_popularity(_bar_id uuid)
RETURNS TABLE(item_id uuid, units bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_bar(_bar_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT oi.item_id, SUM(oi.qty)::bigint AS units
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id AND o.bar_id = _bar_id
    JOIN public.table_sessions ts ON ts.id = o.session_id AND ts.bar_id = _bar_id
    JOIN public.items i ON i.id = oi.item_id AND i.bar_id = _bar_id
    WHERE oi.bar_id = _bar_id
      AND oi.deleted_at IS NULL
      AND ts.status <> 'rejected'
      AND oi.created_at >= now() - interval '30 days'
    GROUP BY oi.item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.menu_popularity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menu_popularity(uuid) TO authenticated;