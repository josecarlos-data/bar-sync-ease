DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.issue_invoice(uuid,uuid,text,text,text,text)'::regprocedure);
  d := replace(d, 'IF NOT (public.is_staff_of(s.bar_id) OR public.is_session_member(_session_id)) THEN',
                  'IF NOT (public.is_staff_of(s.bar_id) OR public.is_session_member(_session_id) OR coalesce(auth.role(),'''') = ''service_role'') THEN');
  EXECUTE d;
END $$;