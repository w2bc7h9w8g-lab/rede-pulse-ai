-- Keep profile immutability checks out of the profiles RLS evaluation itself.
-- SECURITY DEFINER is intentionally limited to reading the current user's row.
CREATE OR REPLACE FUNCTION public.current_profile_campaign_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.campaign_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_must_change_password()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.must_change_password
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_profile_campaign_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_profile_must_change_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_campaign_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_must_change_password() TO authenticated;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND campaign_id IS NOT DISTINCT FROM public.current_profile_campaign_id()
    AND must_change_password IS NOT DISTINCT FROM public.current_profile_must_change_password()
  );
