-- =====================================================================
-- Fase A: funciones opcionales de bar de pueblo
--   Ajustes nuevos, cuentas de fiado, Bizum y lista de espera.
--   Todo aditivo: ninguna columna se elimina y todas tienen default.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ajustes por bar (todos los interruptores, apagados por defecto)
-- ---------------------------------------------------------------------
ALTER TABLE public.bar_settings
  ADD COLUMN IF NOT EXISTS tabs_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bizum_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bizum_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bizum_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS offline_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS special_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS special_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS show_sold_out_notice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_list_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_languages text[] NOT NULL DEFAULT ARRAY['es']::text[],
  ADD COLUMN IF NOT EXISTS menu_default_language text NOT NULL DEFAULT 'es';

-- ---------------------------------------------------------------------
-- 2) Forma de pago en las partes de la cuenta
-- ---------------------------------------------------------------------
ALTER TABLE public.bill_split_parts
  ADD COLUMN IF NOT EXISTS payment_method text;

-- ---------------------------------------------------------------------
-- 3) Cuentas de fiado
-- ---------------------------------------------------------------------
CREATE TABLE public.customer_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_by uuid,
  closed_by uuid,
  paid_method text NOT NULL DEFAULT '',
  CONSTRAINT customer_tabs_status_check CHECK (status IN ('open','closed'))
);
CREATE INDEX customer_tabs_bar_idx ON public.customer_tabs (bar_id, status, opened_at);

CREATE TABLE public.customer_tab_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  tab_id uuid NOT NULL REFERENCES public.customer_tabs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  price_snapshot numeric NOT NULL,
  tax_rate_snapshot numeric NOT NULL DEFAULT 10,
  qty integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_tab_lines_tab_idx ON public.customer_tab_lines (tab_id, created_at);

CREATE TABLE public.customer_tab_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  tab_id uuid NOT NULL REFERENCES public.customer_tabs(id) ON DELETE CASCADE,
  series text NOT NULL,
  number integer NOT NULL,
  snapshot jsonb NOT NULL,
  total numeric NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_tab_invoices_unique UNIQUE (bar_id, series, number)
);
CREATE INDEX customer_tab_invoices_tab_idx ON public.customer_tab_invoices (tab_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tabs TO authenticated;
GRANT ALL ON public.customer_tabs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tab_lines TO authenticated;
GRANT ALL ON public.customer_tab_lines TO service_role;
GRANT SELECT ON public.customer_tab_invoices TO authenticated;
GRANT ALL ON public.customer_tab_invoices TO service_role;

ALTER TABLE public.customer_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tab_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tab_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_tabs" ON public.customer_tabs
  FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));
CREATE POLICY "staff_insert_tabs" ON public.customer_tabs
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "staff_update_tabs" ON public.customer_tabs
  FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "admin_delete_tabs" ON public.customer_tabs
  FOR DELETE TO authenticated USING (public.is_admin_of(bar_id));

CREATE POLICY "staff_select_tab_lines" ON public.customer_tab_lines
  FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));
CREATE POLICY "staff_insert_tab_lines" ON public.customer_tab_lines
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "staff_update_tab_lines" ON public.customer_tab_lines
  FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "staff_delete_tab_lines" ON public.customer_tab_lines
  FOR DELETE TO authenticated USING (public.is_staff_of(bar_id));

CREATE POLICY "staff_select_tab_invoices" ON public.customer_tab_invoices
  FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));

-- Descuento de existencias al apuntar una línea y devolución al borrarla.
CREATE OR REPLACE FUNCTION public.customer_tab_lines_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE i public.items;
BEGIN
  IF NEW.item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO i FROM public.items WHERE id = NEW.item_id;
  IF i.pool_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_pool_delta(i.pool_id, -(NEW.qty * i.pool_portions), 'tab', i.id, NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_pool_delta(i.pool_id, (OLD.qty * i.pool_portions), 'tab_deleted', i.id, NULL);
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER customer_tab_lines_stock_trigger
  AFTER INSERT OR DELETE ON public.customer_tab_lines
  FOR EACH ROW EXECUTE FUNCTION public.customer_tab_lines_stock();

-- Pasar la cuenta: numera (serie FIA), guarda el snapshot y cierra la cuenta.
CREATE OR REPLACE FUNCTION public.close_customer_tab(_tab uuid, _method text DEFAULT 'efectivo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    SELECT price_snapshot*qty t, tax_rate_snapshot r FROM public.customer_tab_lines WHERE tab_id = _tab),
  g AS (SELECT r, sum(t) t FROM l GROUP BY r)
  SELECT coalesce(jsonb_agg(jsonb_build_object('rate',r,'base',round(t/(1+r/100),2),'tax',round(t - t/(1+r/100),2),'total',round(t,2)) ORDER BY r),'[]')
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

REVOKE ALL ON FUNCTION public.close_customer_tab(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_customer_tab(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Lista de espera
-- ---------------------------------------------------------------------
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  people integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  seated_at timestamptz,
  handled_by uuid,
  CONSTRAINT waitlist_entries_status_check CHECK (status IN ('waiting','called','seated','cancelled','no_show'))
);
CREATE INDEX waitlist_entries_bar_idx ON public.waitlist_entries (bar_id, status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_waitlist" ON public.waitlist_entries
  FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));
CREATE POLICY "staff_update_waitlist" ON public.waitlist_entries
  FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "staff_delete_waitlist" ON public.waitlist_entries
  FOR DELETE TO authenticated USING (public.is_staff_of(bar_id));

-- Alta pública (el cliente que espera en la puerta), solo si el bar la activa.
CREATE OR REPLACE FUNCTION public.join_waitlist(_bar uuid, _name text, _phone text DEFAULT '', _people integer DEFAULT 2)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE waiting integer; new_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bar_settings WHERE bar_id = _bar AND waitlist_enabled) THEN
    RAISE EXCEPTION 'waitlist disabled';
  END IF;
  IF btrim(coalesce(_name,'')) = '' OR length(btrim(_name)) > 40 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  IF _people IS NULL OR _people < 1 OR _people > 20 THEN
    RAISE EXCEPTION 'invalid people';
  END IF;
  SELECT count(*) INTO waiting FROM public.waitlist_entries
    WHERE bar_id = _bar AND status IN ('waiting','called');
  IF waiting >= 30 THEN RAISE EXCEPTION 'waitlist full'; END IF;

  INSERT INTO public.waitlist_entries(bar_id, name, phone, people, created_by)
    VALUES (_bar, btrim(_name), btrim(coalesce(_phone,'')), _people, auth.uid())
    RETURNING id INTO new_id;
  RETURN new_id;
END
$function$;

REVOKE ALL ON FUNCTION public.join_waitlist(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(uuid, text, text, integer) TO anon, authenticated;
