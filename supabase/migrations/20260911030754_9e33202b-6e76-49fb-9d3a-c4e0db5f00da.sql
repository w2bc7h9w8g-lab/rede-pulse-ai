CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin');
$$;

CREATE OR REPLACE FUNCTION private.is_coordinator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('coordinator','superadmin'));
$$;

CREATE OR REPLACE FUNCTION private.current_campaign_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT campaign_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.current_leader_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.leaders WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.can_access_leader(_campaign_id uuid, _leader_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_superadmin()
    OR (
      _campaign_id IS NOT NULL
      AND _campaign_id = private.current_campaign_id()
      AND (private.is_coordinator() OR _leader_id = private.current_leader_id())
    );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_coordinator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_campaign_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_leader_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_leader(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_coordinator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_campaign_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_leader_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_leader(uuid, uuid) TO authenticated, service_role;

DROP POLICY analyses_all ON public.analyses;
CREATE POLICY analyses_all ON public.analyses FOR ALL TO authenticated
  USING (private.can_access_leader(campaign_id, leader_id))
  WITH CHECK (private.can_access_leader(campaign_id, leader_id));

DROP POLICY interaction_results_all ON public.interaction_results;
CREATE POLICY interaction_results_all ON public.interaction_results FOR ALL TO authenticated
  USING (private.can_access_leader(campaign_id, leader_id))
  WITH CHECK (private.can_access_leader(campaign_id, leader_id));

DROP POLICY network_members_all ON public.network_members;
CREATE POLICY network_members_all ON public.network_members FOR ALL TO authenticated
  USING (private.can_access_leader(campaign_id, leader_id))
  WITH CHECK (private.can_access_leader(campaign_id, leader_id));

DROP POLICY audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND (campaign_id IS NULL OR campaign_id = private.current_campaign_id()));

DROP POLICY audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated
  USING (private.is_superadmin() OR id = private.current_campaign_id());

DROP POLICY campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated
  USING (private.is_superadmin() OR (id = private.current_campaign_id() AND private.is_coordinator()))
  WITH CHECK (private.is_superadmin() OR (id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY instagram_connections_select ON public.instagram_connections;
CREATE POLICY instagram_connections_select ON public.instagram_connections FOR SELECT TO authenticated
  USING (private.is_superadmin() OR campaign_id = private.current_campaign_id());

DROP POLICY instagram_connections_write ON public.instagram_connections;
CREATE POLICY instagram_connections_write ON public.instagram_connections FOR ALL TO authenticated
  USING (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()))
  WITH CHECK (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY leaders_delete ON public.leaders;
CREATE POLICY leaders_delete ON public.leaders FOR DELETE TO authenticated
  USING (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY leaders_insert ON public.leaders;
CREATE POLICY leaders_insert ON public.leaders FOR INSERT TO authenticated
  WITH CHECK (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY leaders_select ON public.leaders;
CREATE POLICY leaders_select ON public.leaders FOR SELECT TO authenticated
  USING (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND (private.is_coordinator() OR user_id = auth.uid())));

DROP POLICY leaders_update ON public.leaders;
CREATE POLICY leaders_update ON public.leaders FOR UPDATE TO authenticated
  USING (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()))
  WITH CHECK (private.is_superadmin() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT TO authenticated
  USING (private.is_superadmin() OR campaign_id = private.current_campaign_id());

DROP POLICY posts_write ON public.posts;
CREATE POLICY posts_write ON public.posts FOR ALL TO authenticated
  USING (private.is_superadmin() OR campaign_id = private.current_campaign_id())
  WITH CHECK (private.is_superadmin() OR campaign_id = private.current_campaign_id());

DROP POLICY profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (private.is_superadmin() OR id = auth.uid() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP POLICY user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (private.is_superadmin() OR user_id = auth.uid() OR (campaign_id = private.current_campaign_id() AND private.is_coordinator()));

DROP FUNCTION IF EXISTS public.can_access_leader(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_coordinator();
DROP FUNCTION IF EXISTS public.is_superadmin();
DROP FUNCTION IF EXISTS public.current_campaign_id();
DROP FUNCTION IF EXISTS public.current_leader_id();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);