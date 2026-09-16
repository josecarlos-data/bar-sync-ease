ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

ALTER TABLE public.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_decision_check;
ALTER TABLE public.table_sessions
  ADD CONSTRAINT table_sessions_decision_check
  CHECK (decision IS NULL OR decision IN ('approved','rejected','restored'));

DROP INDEX IF EXISTS public.table_sessions_one_active;
CREATE UNIQUE INDEX table_sessions_one_active
  ON public.table_sessions (table_id)
  WHERE status IN ('pending'::session_status, 'open'::session_status);

UPDATE public.table_sessions SET released_at = opened_at WHERE status = 'open' AND released_at IS NULL;

ALTER TABLE public.bar_settings ALTER COLUMN require_session_approval SET DEFAULT false;
UPDATE public.bar_settings SET require_session_approval = false WHERE require_session_approval IS TRUE;

CREATE OR REPLACE FUNCTION public.session_is_open(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_sessions
    WHERE id = _session_id AND status IN ('pending'::session_status, 'open'::session_status)
  );
$$;

CREATE OR REPLACE FUNCTION public.decide_session(_session_id uuid, _decision text, _merge boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.table_sessions;
  active public.table_sessions;
  updated integer;
BEGIN
  SELECT * INTO s FROM public.table_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.is_staff_of(s.bar_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF _decision = 'approved' THEN
    UPDATE public.table_sessions
      SET status = 'open', decision = 'approved', decided_by = auth.uid(),
          decided_at = now(), released_at = now(), last_activity_at = now()
      WHERE id = _session_id AND status = 'pending';
    GET DIAGNOSTICS updated = ROW_COUNT;

  ELSIF _decision = 'rejected' THEN
    UPDATE public.table_sessions
      SET status = 'rejected', decision = 'rejected', decided_by = auth.uid(), decided_at = now()
      WHERE id = _session_id AND status = 'pending';
    GET DIAGNOSTICS updated = ROW_COUNT;

  ELSIF _decision = 'restored' THEN
    IF s.status <> 'rejected' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_decided');
    END IF;

    SELECT * INTO active FROM public.table_sessions
      WHERE table_id = s.table_id AND status IN ('pending','open') LIMIT 1;

    IF active.id IS NOT NULL THEN
      IF NOT _merge THEN
        RETURN jsonb_build_object(
          'ok', false, 'reason', 'active_session',
          'active_session_id', active.id,
          'active_nickname', active.nickname,
          'active_status', active.status
        );
      END IF;

      UPDATE public.orders SET session_id = active.id WHERE session_id = s.id;
      UPDATE public.service_calls SET session_id = active.id WHERE session_id = s.id;
      UPDATE public.table_sessions
        SET status = 'open', decision = 'approved', decided_by = auth.uid(),
            decided_at = now(), released_at = COALESCE(released_at, now()), last_activity_at = now()
        WHERE id = active.id;
      UPDATE public.table_sessions
        SET status = 'closed', decision = 'restored', decided_by = auth.uid(),
            decided_at = now(), closed_at = now(), closed_by = auth.uid()
        WHERE id = s.id AND status = 'rejected';
      GET DIAGNOSTICS updated = ROW_COUNT;
      IF updated > 0 THEN
        RETURN jsonb_build_object('ok', true, 'merged_into', active.id);
      END IF;
    ELSE
      UPDATE public.table_sessions
        SET status = 'open', decision = 'restored', decided_by = auth.uid(),
            decided_at = now(), released_at = now(), last_activity_at = now()
        WHERE id = _session_id AND status = 'rejected';
      GET DIAGNOSTICS updated = ROW_COUNT;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid decision';
  END IF;

  IF updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_decided');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.decide_session(uuid, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_session(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_approve_on_staff_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_role <> 'client' THEN
    UPDATE public.table_sessions
      SET status = 'open', decision = 'approved', decided_by = COALESCE(NEW.created_by, auth.uid()),
          decided_at = now(), released_at = now(), last_activity_at = now()
      WHERE id = NEW.session_id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_approve ON public.orders;
CREATE TRIGGER orders_auto_approve
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_on_staff_order();