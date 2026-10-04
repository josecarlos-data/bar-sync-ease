CREATE OR REPLACE FUNCTION public.split_unassigned(_split_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH s AS (SELECT * FROM public.bill_splits WHERE id = _split_id),
  l AS (
    SELECT oi.id, oi.price_snapshot p, oi.qty q FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id JOIN s ON s.session_id = o.session_id
    WHERE oi.deleted_at IS NULL),
  a AS (
    SELECT ba.order_item_id, sum(ba.qty) q FROM public.bill_split_assignments ba
    JOIN public.bill_split_parts bp ON bp.id = ba.part_id WHERE bp.split_id = _split_id
    GROUP BY 1)
  SELECT coalesce(sum(greatest(l.q - coalesce(a.q,0),0) * l.p),0)
  FROM l LEFT JOIN a ON a.order_item_id = l.id;
$$;

CREATE OR REPLACE FUNCTION public.guard_split_part_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m text;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT mode INTO m FROM public.bill_splits WHERE id = NEW.split_id;
    IF m = 'groups' AND public.split_unassigned(NEW.split_id) > 0.009 THEN
      RAISE EXCEPTION 'unassigned_items';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bill_split_parts_paid_guard ON public.bill_split_parts;
CREATE TRIGGER bill_split_parts_paid_guard BEFORE UPDATE ON public.bill_split_parts
  FOR EACH ROW EXECUTE FUNCTION public.guard_split_part_paid();

CREATE OR REPLACE FUNCTION public.guard_assignment_paid_part()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE st text;
BEGIN
  SELECT status INTO st FROM public.bill_split_parts WHERE id = COALESCE(NEW.part_id, OLD.part_id);
  IF st = 'paid' THEN RAISE EXCEPTION 'part_already_paid'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS bill_split_assignments_paid_guard ON public.bill_split_assignments;
CREATE TRIGGER bill_split_assignments_paid_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bill_split_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_paid_part();

REVOKE EXECUTE ON FUNCTION public.split_unassigned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_unassigned(uuid) TO authenticated;