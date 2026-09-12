-- Auth/security hardening added outside the initial schema migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET must_change_password = false,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;

-- Users must never be able to move their own profile into another campaign or
-- change the administrative first-login flag through the generic profile update.
-- The immutable-value helpers live in a later migration to avoid recursive RLS.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND campaign_id IS NOT DISTINCT FROM public.current_profile_campaign_id()
    AND must_change_password IS NOT DISTINCT FROM public.current_profile_must_change_password()
  );

-- The analysis server function runs with the authenticated user's session and
-- needs to resolve the campaign connection. The field token_secret_name is only
-- a secret-manager key name; the actual access token is never returned to the client.
DROP POLICY IF EXISTS instagram_connections_select ON public.instagram_connections;
CREATE POLICY instagram_connections_select ON public.instagram_connections
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR campaign_id = public.current_campaign_id()
  );
