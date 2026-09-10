-- ENUMS
CREATE TYPE public.app_role AS ENUM ('superadmin', 'coordinator', 'leader');
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive');
CREATE TYPE public.analysis_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE public.interaction_type AS ENUM ('comment', 'mention', 'like', 'share');

-- UPDATED_AT helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  candidate_name TEXT,
  instagram_username TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_campaign ON public.profiles(campaign_id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- LEADERS
CREATE TABLE public.leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  invite_email TEXT,
  phone TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_leaders_user ON public.leaders(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_leaders_campaign_email ON public.leaders(campaign_id, lower(invite_email)) WHERE invite_email IS NOT NULL;
CREATE INDEX idx_leaders_campaign ON public.leaders(campaign_id);

-- NETWORK MEMBERS
CREATE TABLE public.network_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  instagram_username TEXT NOT NULL,
  display_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT network_members_username_unique UNIQUE (leader_id, instagram_username)
);
CREATE INDEX idx_network_members_campaign ON public.network_members(campaign_id);
CREATE INDEX idx_network_members_username ON public.network_members(instagram_username);

-- INSTAGRAM CONNECTIONS
CREATE TABLE public.instagram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta_graph',
  account_username TEXT,
  external_account_id TEXT,
  token_secret_name TEXT,
  status TEXT NOT NULL DEFAULT 'not_connected',
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, provider)
);

-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  external_post_id TEXT,
  shortcode TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  published_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  reach INTEGER,
  impressions INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_posts_campaign_shortcode ON public.posts(campaign_id, shortcode) WHERE shortcode IS NOT NULL;

-- ANALYSES
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_by UUID,
  url TEXT NOT NULL,
  shortcode TEXT,
  status public.analysis_status NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'demo',
  error_message TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  network_size_snapshot INTEGER NOT NULL DEFAULT 0,
  identified_participants_count INTEGER NOT NULL DEFAULT 0,
  participation_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analyses_campaign ON public.analyses(campaign_id, analyzed_at DESC);
CREATE INDEX idx_analyses_leader ON public.analyses(leader_id, analyzed_at DESC);

-- INTERACTION RESULTS
CREATE TABLE public.interaction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  network_member_id UUID REFERENCES public.network_members(id) ON DELETE SET NULL,
  instagram_username TEXT NOT NULL,
  interaction_type public.interaction_type NOT NULL DEFAULT 'comment',
  comment_text TEXT,
  interacted_at TIMESTAMPTZ,
  raw_external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interaction_results_analysis ON public.interaction_results(analysis_id);
CREATE INDEX idx_interaction_results_campaign ON public.interaction_results(campaign_id);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_campaign ON public.audit_logs(campaign_id, created_at DESC);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interaction_results TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.campaigns, public.profiles, public.user_roles, public.leaders,
  public.network_members, public.instagram_connections, public.posts, public.analyses,
  public.interaction_results, public.audit_logs TO service_role;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.current_campaign_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT campaign_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('coordinator','superadmin'));
$$;

CREATE OR REPLACE FUNCTION public.current_leader_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.leaders WHERE user_id = auth.uid() LIMIT 1;
$$;

-- can the current user act on rows of this campaign scoped to this leader?
CREATE OR REPLACE FUNCTION public.can_access_leader(_campaign_id UUID, _leader_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin()
    OR (
      _campaign_id IS NOT NULL
      AND _campaign_id = public.current_campaign_id()
      AND (public.is_coordinator() OR _leader_id = public.current_leader_id())
    );
$$;

-- ensures a profile row and links pending leader invites
CREATE OR REPLACE FUNCTION public.ensure_profile(_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT;
  _leader RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO public.profiles (id, name, email)
  VALUES (_uid, COALESCE(NULLIF(_name, ''), split_part(COALESCE(_email,''), '@', 1)), _email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  -- link a pending leader invite by email
  IF _email IS NOT NULL THEN
    SELECT * INTO _leader FROM public.leaders
      WHERE user_id IS NULL AND lower(invite_email) = lower(_email)
      ORDER BY created_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.leaders SET user_id = _uid, updated_at = now() WHERE id = _leader.id;
      UPDATE public.profiles SET campaign_id = _leader.campaign_id, updated_at = now() WHERE id = _uid;
      INSERT INTO public.user_roles (user_id, role, campaign_id)
        VALUES (_uid, 'leader', _leader.campaign_id) ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END; $$;

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_superadmin() OR id = public.current_campaign_id());
CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR (id = public.current_campaign_id() AND public.is_coordinator()))
  WITH CHECK (public.is_superadmin() OR (id = public.current_campaign_id() AND public.is_coordinator()));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (public.is_superadmin() OR id = auth.uid()
    OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_superadmin() OR user_id = auth.uid()
    OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));

CREATE POLICY leaders_select ON public.leaders FOR SELECT TO authenticated
  USING (public.is_superadmin() OR (campaign_id = public.current_campaign_id()
    AND (public.is_coordinator() OR user_id = auth.uid())));
CREATE POLICY leaders_insert ON public.leaders FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));
CREATE POLICY leaders_update ON public.leaders FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()))
  WITH CHECK (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));
CREATE POLICY leaders_delete ON public.leaders FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));

CREATE POLICY network_members_all ON public.network_members FOR ALL TO authenticated
  USING (public.can_access_leader(campaign_id, leader_id))
  WITH CHECK (public.can_access_leader(campaign_id, leader_id));

CREATE POLICY instagram_connections_select ON public.instagram_connections FOR SELECT TO authenticated
  USING (public.is_superadmin() OR campaign_id = public.current_campaign_id());
CREATE POLICY instagram_connections_write ON public.instagram_connections FOR ALL TO authenticated
  USING (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()))
  WITH CHECK (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));

CREATE POLICY posts_select ON public.posts FOR SELECT TO authenticated
  USING (public.is_superadmin() OR campaign_id = public.current_campaign_id());
CREATE POLICY posts_write ON public.posts FOR ALL TO authenticated
  USING (public.is_superadmin() OR campaign_id = public.current_campaign_id())
  WITH CHECK (public.is_superadmin() OR campaign_id = public.current_campaign_id());

CREATE POLICY analyses_all ON public.analyses FOR ALL TO authenticated
  USING (public.can_access_leader(campaign_id, leader_id))
  WITH CHECK (public.can_access_leader(campaign_id, leader_id));

CREATE POLICY interaction_results_all ON public.interaction_results FOR ALL TO authenticated
  USING (public.can_access_leader(campaign_id, leader_id))
  WITH CHECK (public.can_access_leader(campaign_id, leader_id));

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator()));
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (campaign_id IS NULL OR campaign_id = public.current_campaign_id()));

-- updated_at triggers
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leaders_updated BEFORE UPDATE ON public.leaders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_network_members_updated BEFORE UPDATE ON public.network_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_instagram_connections_updated BEFORE UPDATE ON public.instagram_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_analyses_updated BEFORE UPDATE ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();