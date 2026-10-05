-- Fase 4A: registro de facturación encadenado (Veri*Factu) + ajuste en bar_settings

ALTER TABLE public.bar_settings ADD COLUMN verifactu_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.invoice_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  series text NOT NULL,
  number integer NOT NULL,
  kind text NOT NULL,
  total numeric NOT NULL,
  issued_at timestamptz NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only: nadie actualiza ni borra registros
GRANT SELECT, INSERT ON public.invoice_records TO authenticated;
GRANT SELECT ON public.invoice_records TO anon;
GRANT ALL ON public.invoice_records TO service_role;

ALTER TABLE public.invoice_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lee registros de su bar" ON public.invoice_records
  FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));

CREATE POLICY "Verificación pública por id" ON public.invoice_records
  FOR SELECT TO anon USING (true);

-- Función que genera el registro encadenado al emitir una factura/ticket
CREATE OR REPLACE FUNCTION public.record_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _prev text;
  _payload jsonb;
  _hash text;
BEGIN
  SELECT hash INTO _prev FROM public.invoice_records
    WHERE bar_id = NEW.bar_id ORDER BY created_at DESC, id DESC LIMIT 1;
  _prev := coalesce(_prev, '');
  _payload := jsonb_build_object(
    'invoice_id', NEW.id,
    'series', NEW.series,
    'number', NEW.number,
    'kind', NEW.kind,
    'total', NEW.total,
    'issued_at', NEW.created_at,
    'snapshot', NEW.snapshot
  );
  _hash := encode(sha256(convert_to(_prev || '|' || NEW.id::text || '|' || NEW.series || '|' || NEW.number::text || '|' || NEW.total::text || '|' || NEW.created_at::text, 'UTF8')), 'hex');
  INSERT INTO public.invoice_records (bar_id, invoice_id, series, number, kind, total, issued_at, prev_hash, hash, payload)
  VALUES (NEW.bar_id, NEW.id, NEW.series, NEW.number, NEW.kind, NEW.total, NEW.created_at, _prev, _hash, _payload);
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_record_on_insert
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.record_invoice();

-- Fase 4B: informes agregados por bar (mismo patrón que menu_popularity)

CREATE OR REPLACE FUNCTION public.sales_report(_bar_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(day date, tickets bigint, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT created_at::date AS day, count(*) AS tickets, sum(total) AS total
  FROM public.invoices
  WHERE bar_id = _bar_id AND created_at >= _from AND created_at < _to
    AND public.is_staff_of(_bar_id)
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.sales_by_hour(_bar_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(hour integer, tickets bigint, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(hour FROM created_at)::int AS hour, count(*) AS tickets, sum(total) AS total
  FROM public.invoices
  WHERE bar_id = _bar_id AND created_at >= _from AND created_at < _to
    AND public.is_staff_of(_bar_id)
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.sales_by_method(_bar_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(method text, parts bigint, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p.payment_method, 'efectivo') AS method, count(*) AS parts, sum(p.amount) AS total
  FROM public.bill_split_parts p
  WHERE p.bar_id = _bar_id AND p.status = 'paid'
    AND p.paid_at >= _from AND p.paid_at < _to
    AND public.is_staff_of(_bar_id)
  GROUP BY 1 ORDER BY 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.top_items(_bar_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 15)
RETURNS TABLE(name text, units bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT oi.name_snapshot AS name, sum(oi.qty) AS units, sum(oi.qty * oi.price_snapshot) AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.table_sessions s ON s.id = o.session_id
  WHERE oi.bar_id = _bar_id AND oi.deleted_at IS NULL
    AND s.status = 'closed' AND s.closed_at >= _from AND s.closed_at < _to
    AND public.is_staff_of(_bar_id)
  GROUP BY 1 ORDER BY 2 DESC LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.daily_close(_bar_id uuid, _day date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'day', _day,
    'tickets', (SELECT count(*) FROM public.invoices WHERE bar_id = _bar_id AND created_at::date = _day),
    'invoiced', (SELECT coalesce(sum(total), 0) FROM public.invoices WHERE bar_id = _bar_id AND created_at::date = _day),
    'by_method', (SELECT coalesce(jsonb_agg(jsonb_build_object('method', m.method, 'total', m.total, 'parts', m.parts)), '[]'::jsonb)
                  FROM (SELECT coalesce(payment_method, 'efectivo') AS method, sum(amount) AS total, count(*) AS parts
                        FROM public.bill_split_parts
                        WHERE bar_id = _bar_id AND status = 'paid' AND paid_at::date = _day
                        GROUP BY 1) m),
    'tabs_closed', (SELECT count(*) FROM public.customer_tabs WHERE bar_id = _bar_id AND closed_at::date = _day)
  ) WHERE public.is_staff_of(_bar_id);
$$;