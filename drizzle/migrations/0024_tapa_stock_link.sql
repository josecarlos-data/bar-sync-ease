ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tapa_portions numeric;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tapa_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.order_items_stock()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE i public.items; eff uuid; por numeric;
BEGIN
  eff := coalesce(NEW.item_id, NEW.tapa_item_id);
  IF eff IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public.items WHERE id = eff;
  IF i.pool_id IS NULL THEN RETURN NEW; END IF;
  por := CASE WHEN NEW.tapa_kind IN ('included','round','extra') THEN coalesce(i.tapa_portions, i.pool_portions) ELSE i.pool_portions END;
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    PERFORM public.apply_pool_delta(i.pool_id, -(NEW.qty * por), 'order', i.id, NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.apply_pool_delta(i.pool_id, NEW.qty * por, 'order_deleted', i.id, NEW.id);
  END IF;
  RETURN NEW;
END $function$;