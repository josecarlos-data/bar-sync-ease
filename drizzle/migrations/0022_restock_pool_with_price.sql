CREATE OR REPLACE FUNCTION public.restock_pool(_pool uuid, _qty numeric, _price numeric, _supplier text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.stock_pools; lbl text;
BEGIN
  SELECT * INTO p FROM public.stock_pools WHERE id = _pool;
  IF p.id IS NULL OR NOT public.is_staff_of(p.bar_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;
  UPDATE public.stock_pools
    SET quantity = greatest(quantity, 0) + _qty,
        status = 'open',
        supplier = CASE WHEN nullif(trim(_supplier), '') IS NOT NULL THEN trim(_supplier) ELSE supplier END,
        updated_at = now()
    WHERE id = _pool;
  lbl := 'purchase';
  IF _price IS NOT NULL AND _price > 0 THEN lbl := lbl || ' · ' || trim(to_char(_price, 'FM999999990.00')) || ' €'; END IF;
  IF nullif(trim(_supplier), '') IS NOT NULL THEN lbl := lbl || ' · ' || trim(_supplier); END IF;
  INSERT INTO public.stock_movements(bar_id, pool_id, delta, reason, created_by)
    VALUES (p.bar_id, _pool, _qty, lbl, auth.uid());
  UPDATE public.purchase_items SET status = 'bought', bought_at = now(), qty = _qty
    WHERE pool_id = _pool AND status = 'pending';
END $$;
GRANT EXECUTE ON FUNCTION public.restock_pool(uuid, numeric, numeric, text) TO authenticated;