ALTER TABLE public.bar_settings
  ADD COLUMN ticket_printer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN ticket_print_on_bill boolean NOT NULL DEFAULT true,
  ADD COLUMN ticket_print_on_paid boolean NOT NULL DEFAULT true,
  ADD COLUMN ticket_printer_width integer NOT NULL DEFAULT 80;

CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'provisional' CHECK (kind IN ('provisional','final')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz
);
GRANT SELECT, INSERT ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY print_jobs_staff_select ON public.print_jobs FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));
CREATE POLICY print_jobs_staff_insert ON public.print_jobs FOR INSERT TO authenticated WITH CHECK (public.is_staff_of(bar_id) AND printed_at IS NULL);
CREATE INDEX print_jobs_pending ON public.print_jobs (bar_id) WHERE printed_at IS NULL;
ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;

CREATE OR REPLACE FUNCTION public.claim_print_job(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid; n integer;
BEGIN
  SELECT bar_id INTO b FROM public.print_jobs WHERE id = _id;
  IF b IS NULL OR NOT public.is_staff_of(b) THEN RETURN false; END IF;
  UPDATE public.print_jobs SET printed_at = now() WHERE id = _id AND printed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_print_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.print_job_on_bill() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'bill' AND EXISTS (SELECT 1 FROM public.bar_settings WHERE bar_id = NEW.bar_id AND ticket_printer_enabled AND ticket_print_on_bill) THEN
    INSERT INTO public.print_jobs (bar_id, session_id, kind) VALUES (NEW.bar_id, NEW.session_id, 'provisional');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER service_calls_print_job AFTER INSERT ON public.service_calls FOR EACH ROW EXECUTE FUNCTION public.print_job_on_bill();

CREATE OR REPLACE FUNCTION public.print_job_on_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bar_settings WHERE bar_id = NEW.bar_id AND ticket_printer_enabled AND ticket_print_on_paid) THEN
    INSERT INTO public.print_jobs (bar_id, session_id, invoice_id, kind, created_by) VALUES (NEW.bar_id, NEW.session_id, NEW.id, 'final', NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_print_job AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.print_job_on_invoice();
REVOKE EXECUTE ON FUNCTION public.print_job_on_bill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.print_job_on_invoice() FROM PUBLIC, anon, authenticated;