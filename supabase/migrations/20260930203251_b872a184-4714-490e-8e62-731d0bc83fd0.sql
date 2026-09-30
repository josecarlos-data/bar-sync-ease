ALTER TABLE public.bar_settings
  ADD COLUMN printer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN printer_trigger text NOT NULL DEFAULT 'new' CHECK (printer_trigger IN ('new','ready')),
  ADD COLUMN printer_scope text NOT NULL DEFAULT 'kitchen' CHECK (printer_scope IN ('kitchen','bar','both')),
  ADD COLUMN printer_width integer NOT NULL DEFAULT 80 CHECK (printer_width IN (58,80)),
  ADD COLUMN legal_name text,
  ADD COLUMN tax_id text,
  ADD COLUMN address text,
  ADD COLUMN phone text,
  ADD COLUMN ticket_footer text;

ALTER TABLE public.orders ADD COLUMN printed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_print(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid; n integer;
BEGIN
  SELECT bar_id INTO b FROM public.orders WHERE id = _order_id;
  IF b IS NULL OR NOT public.is_staff_of(b) THEN RETURN false; END IF;
  UPDATE public.orders SET printed_at = now() WHERE id = _order_id AND printed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_print(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_print(uuid) TO authenticated;

CREATE TABLE public.invoice_counters (
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  series text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bar_id, series)
);
GRANT ALL ON public.invoice_counters TO service_role;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  split_part_id uuid REFERENCES public.bill_split_parts(id) ON DELETE SET NULL,
  series text NOT NULL,
  number integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('simplified','full')),
  customer_name text,
  customer_tax_id text,
  customer_address text,
  snapshot jsonb NOT NULL,
  total numeric(10,2) NOT NULL,
  created_by uuid,
  emailed_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bar_id, series, number)
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (public.is_staff_of(bar_id) OR public.is_session_member(session_id));

CREATE OR REPLACE FUNCTION public.issue_invoice(
  _session_id uuid, _split_part_id uuid DEFAULT NULL, _kind text DEFAULT 'simplified',
  _customer_name text DEFAULT NULL, _customer_tax_id text DEFAULT NULL, _customer_address text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.table_sessions; st public.bar_settings; bname text; tnum integer; tname text;
  existing uuid; ser text; num integer; lines jsonb; breakdown jsonb; tot numeric; full_tot numeric;
  part public.bill_split_parts; factor numeric := 1; new_id uuid; has_assign boolean := false;
BEGIN
  SELECT * INTO s FROM public.table_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.is_staff_of(s.bar_id) OR public.is_session_member(_session_id)) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _kind NOT IN ('simplified','full') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF _kind = 'full' AND (coalesce(trim(_customer_name),'') = '' OR coalesce(trim(_customer_tax_id),'') = '') THEN
    RAISE EXCEPTION 'customer data required'; END IF;

  IF _kind = 'simplified' THEN
    SELECT id INTO existing FROM public.invoices WHERE session_id = _session_id AND kind = 'simplified'
      AND split_part_id IS NOT DISTINCT FROM _split_part_id LIMIT 1;
    IF existing IS NOT NULL THEN RETURN existing; END IF;
  END IF;

  SELECT * INTO st FROM public.bar_settings WHERE bar_id = s.bar_id;
  SELECT name INTO bname FROM public.bars WHERE id = s.bar_id;
  SELECT number, name INTO tnum, tname FROM public.tables WHERE id = s.table_id;

  IF _split_part_id IS NOT NULL THEN
    SELECT * INTO part FROM public.bill_split_parts WHERE id = _split_part_id;
    SELECT EXISTS (SELECT 1 FROM public.bill_split_assignments WHERE part_id = _split_part_id) INTO has_assign;
  END IF;

  IF has_assign THEN
    WITH l AS (
      SELECT oi.name_snapshot n, oi.price_snapshot p, oi.tax_rate_snapshot r, a.qty q
      FROM public.bill_split_assignments a JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE a.part_id = _split_part_id AND oi.deleted_at IS NULL)
    SELECT coalesce(jsonb_agg(jsonb_build_object('name',n,'price',p,'tax_rate',r,'qty',q,'total',round(p*q,2))),'[]'),
           coalesce(sum(round(p*q,2)),0) INTO lines, tot FROM l;
    WITH l AS (
      SELECT oi.price_snapshot*a.qty t, oi.tax_rate_snapshot r FROM public.bill_split_assignments a
      JOIN public.order_items oi ON oi.id = a.order_item_id WHERE a.part_id = _split_part_id AND oi.deleted_at IS NULL),
    g AS (SELECT r, sum(t) t FROM l GROUP BY r)
    SELECT coalesce(jsonb_agg(jsonb_build_object('rate',r,'base',round(t/(1+r/100),2),'tax',round(t - t/(1+r/100),2),'total',round(t,2))),'[]') INTO breakdown FROM g;
  ELSE
    WITH l AS (
      SELECT oi.name_snapshot n, oi.price_snapshot p, oi.tax_rate_snapshot r, sum(oi.qty) q
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE o.session_id = _session_id AND oi.deleted_at IS NULL
      GROUP BY 1,2,3)
    SELECT coalesce(jsonb_agg(jsonb_build_object('name',n,'price',p,'tax_rate',r,'qty',q,'total',round(p*q,2)) ORDER BY n),'[]'),
           coalesce(sum(round(p*q,2)),0) INTO lines, full_tot FROM l;
    tot := full_tot;
    IF _split_part_id IS NOT NULL AND full_tot > 0 THEN tot := part.amount; factor := part.amount / full_tot; END IF;
    WITH l AS (
      SELECT oi.price_snapshot*oi.qty*factor t, oi.tax_rate_snapshot r FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id WHERE o.session_id = _session_id AND oi.deleted_at IS NULL),
    g AS (SELECT r, sum(t) t FROM l GROUP BY r)
    SELECT coalesce(jsonb_agg(jsonb_build_object('rate',r,'base',round(t/(1+r/100),2),'tax',round(t - t/(1+r/100),2),'total',round(t,2))),'[]') INTO breakdown FROM g;
  END IF;

  ser := CASE WHEN _kind = 'full' THEN 'F' ELSE 'T' END || to_char(now(),'YYYY');
  INSERT INTO public.invoice_counters(bar_id, series, last_number) VALUES (s.bar_id, ser, 1)
    ON CONFLICT (bar_id, series) DO UPDATE SET last_number = invoice_counters.last_number + 1
    RETURNING last_number INTO num;

  INSERT INTO public.invoices(bar_id, session_id, split_part_id, series, number, kind, customer_name, customer_tax_id,
    customer_address, snapshot, total, created_by)
  VALUES (s.bar_id, _session_id, _split_part_id, ser, num, _kind, _customer_name, _customer_tax_id, _customer_address,
    jsonb_build_object(
      'bar', jsonb_build_object('name', bname, 'legal_name', st.legal_name, 'tax_id', st.tax_id, 'address', st.address, 'phone', st.phone, 'footer', st.ticket_footer),
      'table', jsonb_build_object('number', tnum, 'name', tname, 'nickname', s.nickname),
      'part_label', part.label, 'partial', (_split_part_id IS NOT NULL AND NOT has_assign),
      'lines', lines, 'breakdown', breakdown),
    tot, auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.issue_invoice(uuid,uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid,uuid,text,text,text,text) TO authenticated;