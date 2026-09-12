-- Super Admin control-plane hardening
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS party TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leaders_coordinator ON public.leaders(coordinator_id);

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token)
);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(lower(email));
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invitations TO authenticated;

DROP POLICY IF EXISTS user_invitations_superadmin ON public.user_invitations;
CREATE POLICY user_invitations_superadmin ON public.user_invitations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id UUID, _role public.app_role, _campaign_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _role <> 'superadmin' AND _campaign_id IS NULL THEN RAISE EXCEPTION 'Campaign is required'; END IF;
  IF _campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = _campaign_id) THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  INSERT INTO public.user_roles(user_id, role, campaign_id)
  VALUES (_user_id, _role, _campaign_id)
  ON CONFLICT (user_id, role) DO UPDATE SET campaign_id = EXCLUDED.campaign_id;
  IF _role IN ('coordinator','leader') THEN
    UPDATE public.profiles SET campaign_id = _campaign_id, updated_at = now() WHERE id = _user_id;
  ELSIF _role = 'superadmin' THEN
    UPDATE public.profiles SET campaign_id = NULL, updated_at = now() WHERE id = _user_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, public.app_role, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, public.app_role, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id UUID, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id = auth.uid() AND _role = 'superadmin' THEN RAISE EXCEPTION 'Cannot remove your own superadmin role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  IF _role = 'coordinator' THEN UPDATE public.leaders SET coordinator_id = NULL WHERE coordinator_id = _user_id; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_remove_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(UUID, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_leader(_leader_id UUID, _campaign_id UUID, _coordinator_id UUID DEFAULT NULL, _user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = _campaign_id) THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF _coordinator_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _coordinator_id AND role = 'coordinator' AND campaign_id = _campaign_id
  ) THEN RAISE EXCEPTION 'Coordinator is not assigned to this campaign'; END IF;
  IF _user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  UPDATE public.leaders SET campaign_id = _campaign_id, coordinator_id = _coordinator_id, user_id = COALESCE(_user_id, user_id), updated_at = now() WHERE id = _leader_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leader not found'; END IF;
  IF _user_id IS NOT NULL THEN PERFORM public.admin_set_user_role(_user_id, 'leader', _campaign_id); END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_assign_leader(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_leader(UUID, UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_leader_coordinator()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.coordinator_id IS NULL AND public.is_coordinator() AND NOT public.is_superadmin() THEN NEW.coordinator_id := auth.uid(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_leader_coordinator ON public.leaders;
CREATE TRIGGER trg_leader_coordinator BEFORE INSERT ON public.leaders FOR EACH ROW EXECUTE FUNCTION public.set_leader_coordinator();

CREATE OR REPLACE FUNCTION public.can_access_leader(_campaign_id UUID, _leader_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.leaders l
    WHERE l.id = _leader_id AND l.campaign_id = _campaign_id
      AND (l.user_id = auth.uid() OR (public.is_coordinator() AND _campaign_id = public.current_campaign_id() AND (l.coordinator_id = auth.uid() OR l.coordinator_id IS NULL)))
  );
$$;

DROP POLICY IF EXISTS leaders_select ON public.leaders;
CREATE POLICY leaders_select ON public.leaders FOR SELECT TO authenticated USING (public.is_superadmin() OR public.can_access_leader(campaign_id, id));
DROP POLICY IF EXISTS leaders_insert ON public.leaders;
CREATE POLICY leaders_insert ON public.leaders FOR INSERT TO authenticated WITH CHECK (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator() AND (coordinator_id = auth.uid() OR coordinator_id IS NULL)));
DROP POLICY IF EXISTS leaders_update ON public.leaders;
CREATE POLICY leaders_update ON public.leaders FOR UPDATE TO authenticated USING (public.is_superadmin() OR public.can_access_leader(campaign_id, id)) WITH CHECK (public.is_superadmin() OR (campaign_id = public.current_campaign_id() AND public.is_coordinator() AND (coordinator_id = auth.uid() OR coordinator_id IS NULL)));
DROP POLICY IF EXISTS leaders_delete ON public.leaders;
CREATE POLICY leaders_delete ON public.leaders FOR DELETE TO authenticated USING (public.is_superadmin() OR public.can_access_leader(campaign_id, id));

DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
CREATE POLICY campaigns_insert ON public.campaigns FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());
DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
CREATE POLICY campaigns_delete ON public.campaigns FOR DELETE TO authenticated USING (public.is_superadmin());

-- Invitation-aware profile bootstrap. Existing leader-email linking remains compatible.
CREATE OR REPLACE FUNCTION public.ensure_profile(_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _email TEXT; _leader RECORD; _invite RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  INSERT INTO public.profiles (id, name, email)
  VALUES (_uid, COALESCE(NULLIF(_name, ''), split_part(COALESCE(_email,''), '@', 1)), _email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  IF _email IS NOT NULL THEN
    SELECT * INTO _invite FROM public.user_invitations WHERE accepted_at IS NULL AND lower(email) = lower(_email) AND expires_at > now() ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.user_roles(user_id, role, campaign_id) VALUES (_uid, _invite.role, _invite.campaign_id)
        ON CONFLICT (user_id, role) DO UPDATE SET campaign_id = EXCLUDED.campaign_id;
      UPDATE public.profiles SET campaign_id = _invite.campaign_id, updated_at = now() WHERE id = _uid;
      UPDATE public.user_invitations SET accepted_at = now() WHERE id = _invite.id;
    END IF;
    SELECT * INTO _leader FROM public.leaders WHERE user_id IS NULL AND lower(invite_email) = lower(_email) ORDER BY created_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.leaders SET user_id = _uid, updated_at = now() WHERE id = _leader.id;
      UPDATE public.profiles SET campaign_id = _leader.campaign_id, updated_at = now() WHERE id = _uid;
      INSERT INTO public.user_roles(user_id, role, campaign_id) VALUES (_uid, 'leader', _leader.campaign_id)
        ON CONFLICT (user_id, role) DO UPDATE SET campaign_id = EXCLUDED.campaign_id;
    END IF;
  END IF;
END;
$$;
