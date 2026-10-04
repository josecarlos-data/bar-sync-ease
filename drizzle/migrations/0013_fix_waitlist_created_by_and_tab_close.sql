-- 1) La alta en la lista de espera guardaba quién la creó, pero la tabla no tenía esa columna.
ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2) «Pasar la cuenta» fallaba porque dentro de la función el alias «t»
--    coincidía con la variable «t» de la propia cuenta (referencia ambigua).
CREATE OR REPLACE FUNCTION public.close_customer_tab(_tab uuid, _method text DEFAULT 'efectivo'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.customer_tabs;
  st public.bar_settings;
  bname text;
  ser text;
  num integer;
  lines jsonb;
  breakdown jsonb;
  tot numeric;
  new_id uuid;
BEGIN
  SELECT * INTO t FROM public.customer_tabs WHERE id = _tab;
  IF t.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.is_staff_of(t.bar_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF t.status <> 'open' THEN RAISE EXCEPTION 'already closed'; END IF;
  IF _method NOT IN ('efectivo','tarjeta','bizum','') THEN RAISE EXCEPTION 'invalid method'; END IF;

  WITH l AS (
    SELECT name_snapshot n, price_snapshot p, tax_rate_snapshot r, sum(qty) q
    FROM public.customer_tab_lines WHERE tab_id = _tab GROUP BY 1,2,3)
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',n,'price',p,'tax_rate',r,'qty',q,'total',round(p*q,2)) ORDER BY n),'[]'),
         coalesce(sum(round(p*q,2)),0) INTO lines, tot FROM l;
  IF tot <= 0 THEN RAISE EXCEPTION 'empty tab'; END IF;

  WITH l AS (
    SELECT price_snapshot*qty AS amount, tax_rate_snapshot AS rate
    FROM public.customer_tab_lines WHERE tab_id = _tab),
  g AS (SELECT rate, sum(amount) AS amount FROM l GROUP BY rate)
  SELECT coalesce(jsonb_agg(jsonb_build_object('rate',rate,'base',round(amount/(1+rate/100),2),
                                               'tax',round(amount - amount/(1+rate/100),2),
                                               'total',round(amount,2)) ORDER BY rate),'[]')
    INTO breakdown FROM g;

  SELECT * INTO st FROM public.bar_settings WHERE bar_id = t.bar_id;
  SELECT name INTO bname FROM public.bars WHERE id = t.bar_id;

  ser := 'FIA' || to_char(now(),'YYYY');
  INSERT INTO public.invoice_counters(bar_id, series, last_number) VALUES (t.bar_id, ser, 1)
    ON CONFLICT (bar_id, series) DO UPDATE SET last_number = invoice_counters.last_number + 1
    RETURNING last_number INTO num;

  INSERT INTO public.customer_tab_invoices(bar_id, tab_id, series, number, snapshot, total, created_by)
  VALUES (t.bar_id, _tab, ser, num,
    jsonb_build_object(
      'bar', jsonb_build_object('name', bname, 'legal_name', st.legal_name, 'tax_id', st.tax_id,
                                'address', st.address, 'phone', st.phone, 'footer', st.ticket_footer),
      'tab', jsonb_build_object('name', t.name, 'phone', t.phone, 'note', t.note, 'opened_at', t.opened_at),
      'method', _method,
      'lines', lines,
      'breakdown', breakdown),
    tot, auth.uid())
  RETURNING id INTO new_id;

  UPDATE public.customer_tabs
    SET status = 'closed', closed_at = now(), closed_by = auth.uid(), paid_method = _method
    WHERE id = _tab;

  RETURN new_id;
END
$function$;