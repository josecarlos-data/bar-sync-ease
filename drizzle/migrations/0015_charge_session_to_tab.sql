ALTER TABLE public.customer_tab_lines ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.table_sessions ADD COLUMN IF NOT EXISTS charged_tab_id uuid REFERENCES public.customer_tabs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.customer_tab_lines_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i public.items; r public.customer_tab_lines;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF r.item_id IS NULL OR r.source_session_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  SELECT * INTO i FROM public.items WHERE id = r.item_id;
  IF i.pool_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.apply_pool_delta(i.pool_id, -(r.qty * i.pool_portions), 'tab', i.id, NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.apply_pool_delta(i.pool_id, (r.qty * i.pool_portions), 'tab_deleted', i.id, NULL);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.charge_session_to_tab(_session uuid, _tab uuid, _split_part uuid DEFAULT NULL, _amount numeric DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.table_sessions; t public.customer_tabs; p public.bill_split_parts;
  lbl text; note text; tot numeric := 0; paid numeric := 0; main_rate numeric; spl uuid;
BEGIN
  SELECT * INTO s FROM public.table_sessions WHERE id = _session FOR UPDATE;
  SELECT * INTO t FROM public.customer_tabs WHERE id = _tab;
  IF s.id IS NULL OR t.id IS NULL OR s.bar_id <> t.bar_id THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.is_staff_of(s.bar_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NOT coalesce((SELECT tabs_enabled FROM public.bar_settings WHERE bar_id = s.bar_id), false) THEN RAISE EXCEPTION 'tabs disabled'; END IF;
  IF t.status <> 'open' THEN RAISE EXCEPTION 'tab closed'; END IF;
  IF s.status NOT IN ('open','pending') THEN RAISE EXCEPTION 'session closed'; END IF;

  SELECT CASE WHEN tb.kind = 'counter' THEN 'Barra ' || (tb.number - 900) ELSE coalesce(tb.name, 'Mesa ' || tb.number) END
    INTO lbl FROM public.tables tb WHERE tb.id = s.table_id;
  note := lbl || ' · ' || to_char(now() AT TIME ZONE 'Europe/Madrid', 'DD/MM');

  SELECT oi.tax_rate_snapshot INTO main_rate FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE o.session_id = _session AND oi.deleted_at IS NULL
    GROUP BY 1 ORDER BY sum(oi.price_snapshot*oi.qty) DESC LIMIT 1;
  main_rate := coalesce(main_rate, 10);

  IF _split_part IS NOT NULL THEN
    SELECT * INTO p FROM public.bill_split_parts WHERE id = _split_part FOR UPDATE;
    IF p.id IS NULL OR p.status = 'paid' THEN RAISE EXCEPTION 'part not available'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bill_splits b WHERE b.id = p.split_id AND b.session_id = _session) THEN RAISE EXCEPTION 'part mismatch'; END IF;
    IF EXISTS (SELECT 1 FROM public.bill_split_assignments WHERE part_id = p.id) THEN
      INSERT INTO public.customer_tab_lines(bar_id, tab_id, item_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note, created_by, source_session_id)
      SELECT s.bar_id, _tab, oi.item_id,
        CASE WHEN a.qty = trunc(a.qty) THEN oi.name_snapshot ELSE oi.name_snapshot || ' (' || round(a.qty,2) || ')' END,
        CASE WHEN a.qty = trunc(a.qty) THEN oi.price_snapshot ELSE round(oi.price_snapshot*a.qty,2) END,
        oi.tax_rate_snapshot,
        CASE WHEN a.qty = trunc(a.qty) THEN a.qty::int ELSE 1 END,
        note || ' · ' || p.label, auth.uid(), _session
      FROM public.bill_split_assignments a JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE a.part_id = p.id AND oi.deleted_at IS NULL AND a.qty > 0;
      SELECT coalesce(sum(price_snapshot*qty),0) INTO tot FROM public.customer_tab_lines WHERE tab_id = _tab AND source_session_id = _session AND note = note || ' · ' || p.label;
    ELSE
      tot := round(coalesce(_amount, p.amount), 2);
      IF tot <= 0 THEN RAISE EXCEPTION 'empty'; END IF;
      INSERT INTO public.customer_tab_lines(bar_id, tab_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note, created_by, source_session_id)
      VALUES (s.bar_id, _tab, 'Parte de la cuenta: ' || p.label, tot, main_rate, 1, note, auth.uid(), _session);
    END IF;
    UPDATE public.bill_split_parts SET status = 'paid', paid_at = now(), amount = coalesce(_amount, amount), payment_method = 'fiado: ' || t.name WHERE id = p.id;
    RETURN tot;
  END IF;

  INSERT INTO public.customer_tab_lines(bar_id, tab_id, item_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note, created_by, source_session_id)
  SELECT s.bar_id, _tab, oi.item_id, oi.name_snapshot, oi.price_snapshot, oi.tax_rate_snapshot, oi.qty, note, auth.uid(), _session
  FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
  WHERE o.session_id = _session AND oi.deleted_at IS NULL AND oi.qty > 0;
  SELECT coalesce(sum(oi.price_snapshot*oi.qty),0) INTO tot FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE o.session_id = _session AND oi.deleted_at IS NULL;
  IF tot <= 0 THEN RAISE EXCEPTION 'empty'; END IF;

  SELECT coalesce(sum(pp.amount),0) INTO paid FROM public.bill_split_parts pp JOIN public.bill_splits b ON b.id = pp.split_id
    WHERE b.session_id = _session AND pp.status = 'paid';
  IF paid > 0 THEN
    INSERT INTO public.customer_tab_lines(bar_id, tab_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note, created_by, source_session_id)
    VALUES (s.bar_id, _tab, 'Ya pagado en la mesa', -round(paid,2), main_rate, 1, note, auth.uid(), _session);
    tot := tot - paid;
  END IF;

  UPDATE public.order_items oi SET status = 'served', served_at = coalesce(served_at, now())
    FROM public.orders o WHERE o.id = oi.order_id AND o.session_id = _session AND oi.deleted_at IS NULL AND oi.status <> 'served';
  UPDATE public.table_sessions SET status = 'closed', closed_at = now(), closed_by = auth.uid(), charged_tab_id = _tab WHERE id = _session;
  RETURN tot;
END $$;

REVOKE ALL ON FUNCTION public.charge_session_to_tab(uuid, uuid, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.charge_session_to_tab(uuid, uuid, uuid, numeric) TO authenticated;