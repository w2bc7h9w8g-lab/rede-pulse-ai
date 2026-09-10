REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_coordinator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_campaign_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_leader_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_leader(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_campaign_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_leader_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_leader(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;