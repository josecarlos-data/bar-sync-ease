ALTER TABLE public.stock_pools ADD COLUMN IF NOT EXISTS target_qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.stock_pools ADD COLUMN IF NOT EXISTS supplier text NOT NULL DEFAULT '';

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.stock_pools(id) ON DELETE CASCADE,
  name text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_label text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  auto boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  bought_at timestamptz
);
CREATE UNIQUE INDEX purchase_items_one_pending_per_pool ON public.purchase_items(pool_id) WHERE status = 'pending' AND pool_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage purchase items" ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_items;

CREATE OR REPLACE FUNCTION public.stock_pool_to_purchase() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE enabled boolean; need numeric;
BEGIN
  SELECT purchase_list_enabled INTO enabled FROM public.bar_settings WHERE bar_id = NEW.bar_id;
  IF NOT coalesce(enabled,false) THEN RETURN NEW; END IF;
  IF NEW.status = 'depleted' OR NEW.quantity <= NEW.low_threshold THEN
    need := greatest(1, coalesce(nullif(NEW.target_qty,0), NEW.low_threshold * 4, 1) - greatest(NEW.quantity,0));
    INSERT INTO public.purchase_items(bar_id,pool_id,name,qty,unit_label,supplier,auto)
      VALUES (NEW.bar_id,NEW.id,NEW.name,need,NEW.unit_label,NEW.supplier,true)
      ON CONFLICT (pool_id) WHERE status='pending' AND pool_id IS NOT NULL
      DO UPDATE SET qty = CASE WHEN purchase_items.auto THEN EXCLUDED.qty ELSE purchase_items.qty END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_pool_purchase AFTER INSERT OR UPDATE OF quantity, status, low_threshold ON public.stock_pools
  FOR EACH ROW EXECUTE FUNCTION public.stock_pool_to_purchase();

CREATE OR REPLACE FUNCTION public.mark_purchase_bought(_id uuid, _qty numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pi public.purchase_items; p public.stock_pools;
BEGIN
  SELECT * INTO pi FROM public.purchase_items WHERE id=_id;
  IF pi.id IS NULL OR NOT public.is_staff_of(pi.bar_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.purchase_items SET status='bought', bought_at=now(), qty=_qty WHERE id=_id;
  IF pi.pool_id IS NOT NULL THEN
    SELECT * INTO p FROM public.stock_pools WHERE id=pi.pool_id;
    PERFORM public.stock_action(pi.pool_id, 'refill', greatest(p.quantity,0) + _qty);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_purchase_bought(uuid, numeric) TO authenticated;