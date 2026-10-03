CREATE TABLE public.stock_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_label text NOT NULL DEFAULT 'porciones',
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  low_threshold numeric(10,2) NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirm_pending','depleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_pools TO authenticated;
GRANT ALL ON public.stock_pools TO service_role;
ALTER TABLE public.stock_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_pools_select ON public.stock_pools FOR SELECT TO authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY stock_pools_admin_ins ON public.stock_pools FOR INSERT TO authenticated WITH CHECK (public.is_admin_of(bar_id));
CREATE POLICY stock_pools_admin_upd ON public.stock_pools FOR UPDATE TO authenticated USING (public.is_admin_of(bar_id));
CREATE POLICY stock_pools_admin_del ON public.stock_pools FOR DELETE TO authenticated USING (public.is_admin_of(bar_id));

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  pool_id uuid NOT NULL REFERENCES public.stock_pools(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  delta numeric(10,2) NOT NULL,
  reason text NOT NULL CHECK (reason IN ('order','order_deleted','manual','refill','waste','deplete','reopen','confirm')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_bar_time ON public.stock_movements(bar_id, created_at);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));

ALTER TABLE public.items ADD COLUMN pool_id uuid REFERENCES public.stock_pools(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN pool_portions numeric(10,2) NOT NULL DEFAULT 1;
ALTER TABLE public.bar_settings ADD COLUMN stock_zero_action text NOT NULL DEFAULT 'confirm' CHECK (stock_zero_action IN ('confirm','auto'));

CREATE OR REPLACE FUNCTION public.apply_pool_delta(_pool uuid, _delta numeric, _reason text, _item uuid, _oi uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.stock_pools; act text;
BEGIN
  UPDATE public.stock_pools SET quantity = quantity + _delta, updated_at = now() WHERE id = _pool RETURNING * INTO p;
  IF p.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.stock_movements(bar_id,pool_id,item_id,order_item_id,delta,reason,created_by)
    VALUES (p.bar_id,_pool,_item,_oi,_delta,_reason,auth.uid());
  IF p.quantity <= 0 AND p.status = 'open' THEN
    SELECT stock_zero_action INTO act FROM public.bar_settings WHERE bar_id = p.bar_id;
    IF act = 'auto' THEN
      UPDATE public.stock_pools SET status='depleted' WHERE id=_pool;
      UPDATE public.items SET available=false WHERE pool_id=_pool;
    ELSE
      UPDATE public.stock_pools SET status='confirm_pending' WHERE id=_pool;
    END IF;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_pool_delta(uuid,numeric,text,uuid,uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.order_items_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.items;
BEGIN
  IF NEW.item_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public.items WHERE id = NEW.item_id;
  IF i.pool_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    PERFORM public.apply_pool_delta(i.pool_id, -(NEW.qty * i.pool_portions), 'order', i.id, NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.apply_pool_delta(i.pool_id, NEW.qty * i.pool_portions, 'order_deleted', i.id, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_items_stock_trg AFTER INSERT OR UPDATE OF deleted_at ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_stock();

-- staff actions: adjust | refill | waste | deplete | reopen | keep
CREATE OR REPLACE FUNCTION public.stock_action(_pool uuid, _action text, _qty numeric DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.stock_pools;
BEGIN
  SELECT * INTO p FROM public.stock_pools WHERE id = _pool;
  IF p.id IS NULL OR NOT public.is_staff_of(p.bar_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _action = 'adjust' THEN
    PERFORM public.apply_pool_delta(_pool, _qty, 'manual', NULL, NULL);
  ELSIF _action = 'waste' THEN
    PERFORM public.apply_pool_delta(_pool, -abs(_qty), 'waste', NULL, NULL);
  ELSIF _action IN ('refill','keep','reopen') THEN
    UPDATE public.stock_pools SET quantity = CASE WHEN _action='reopen' AND _qty=0 THEN quantity ELSE _qty END,
      status='open', updated_at=now() WHERE id=_pool;
    UPDATE public.items SET available=true WHERE pool_id=_pool;
    INSERT INTO public.stock_movements(bar_id,pool_id,delta,reason,created_by)
      VALUES (p.bar_id,_pool,_qty - p.quantity, CASE _action WHEN 'refill' THEN 'refill' WHEN 'keep' THEN 'confirm' ELSE 'reopen' END, auth.uid());
  ELSIF _action = 'deplete' THEN
    UPDATE public.stock_pools SET status='depleted', updated_at=now() WHERE id=_pool;
    UPDATE public.items SET available=false WHERE pool_id=_pool;
    INSERT INTO public.stock_movements(bar_id,pool_id,delta,reason,created_by) VALUES (p.bar_id,_pool,0,'deplete',auth.uid());
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.stock_action(uuid,text,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.stock_action(uuid,text,numeric) TO authenticated;

ALTER TABLE public.stock_pools REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_pools;