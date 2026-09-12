-- Auth/security hardening added outside the initial schema migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Clear the first-login flag only for the currently authenticated user.
-- This is intentionally a SECURITY DEFINER RPC so the profile RLS policy does
-- not need to allow arbitrary clients to change an authorization/onboarding flag.
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
-- clear the administrative first-login flag through the generic profile update.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND campaign_id IS NOT DISTINCT FROM (
      SELECT p.campaign_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND must_change_password IS NOT DISTINCT FROM (
      SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Ordinary leaders do not need Instagram connection metadata (especially
-- token_secret_name). Coordinators and Super Admins may manage the connection.
DROP POLICY IF EXISTS instagram_connections_select ON public.instagram_connections;
CREATE POLICY instagram_connections_select ON public.instagram_connections
  FOR SELECT TO authenticated
  USING (
    private.is_superadmin()
    OR (
      campaign_id = private.current_campaign_id()
      AND private.is_coordinator()
    )
  );
