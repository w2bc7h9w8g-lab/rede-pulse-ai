-- Integrity hardening for leader-scoped network access.
-- Prevent a caller from using a valid leader_id together with a mismatched campaign_id.
CREATE OR REPLACE FUNCTION public.can_access_leader(_campaign_id UUID, _leader_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leaders l
    WHERE l.id = _leader_id
      AND l.campaign_id = _campaign_id
      AND (
        public.is_superadmin()
        OR (
          _campaign_id IS NOT NULL
          AND _campaign_id = public.current_campaign_id()
          AND (public.is_coordinator() OR l.user_id = auth.uid())
        )
      )
  );
$$;

-- Keep role/campaign assignments internally consistent for future writes.
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR user_id = auth.uid()
    OR (campaign_id = public.current_campaign_id() AND public.is_coordinator())
  );

-- A leader must belong to the same campaign as the network member row.
DROP POLICY IF EXISTS network_members_all ON public.network_members;
CREATE POLICY network_members_all ON public.network_members
  FOR ALL TO authenticated
  USING (public.can_access_leader(campaign_id, leader_id))
  WITH CHECK (public.can_access_leader(campaign_id, leader_id));
