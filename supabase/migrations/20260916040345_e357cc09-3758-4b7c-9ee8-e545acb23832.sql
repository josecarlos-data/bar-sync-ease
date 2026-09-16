
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff_of(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_of(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.session_is_open(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_guest_of_bar(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_bar(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_is_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guest_of_bar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_bar(uuid) TO authenticated;
