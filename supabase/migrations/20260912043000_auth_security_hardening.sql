-- Auth/security hardening added outside the initial schema migration.
-- Keep this migration idempotent because the cloud database may already contain the column.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Users must never be able to move their own profile into another campaign or
-- clear an administrative onboarding flag. Their own profile update is limited
-- to non-authoritative fields by the policy below; role/campaign state is owned
-- by the platform/coordinator flows.
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

-- Leaders do not need to read campaign Instagram connection metadata.
-- In particular, token_secret_name must not be exposed to ordinary leaders.
DROP POLICY IF EXISTS instagram_connections_select ON public.instagram_connections;
CREATE POLICY instagram_connections_select ON public.instagram_connections
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (
      campaign_id = public.current_campaign_id()
      AND public.is_coordinator()
    )
  );
