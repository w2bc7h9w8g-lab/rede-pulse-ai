CREATE OR REPLACE FUNCTION public.create_leader_invitation(_leader_id UUID)
RETURNS TABLE(leader_id UUID, token UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _leader public.leaders%ROWTYPE;
  _token UUID;
  _expires TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR (NOT public.is_coordinator() AND NOT public.is_superadmin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _leader FROM public.leaders WHERE id = _leader_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leader not found'; END IF;
  IF NOT public.is_superadmin() AND NOT (_leader.campaign_id = public.current_campaign_id() AND (_leader.coordinator_id = auth.uid() OR _leader.coordinator_id IS NULL)) THEN
    RAISE EXCEPTION 'Leader is outside your campaign';
  END IF;
  IF _leader.user_id IS NOT NULL THEN RAISE EXCEPTION 'Leader already has access'; END IF;
  IF _leader.invite_email IS NULL OR btrim(_leader.invite_email) = '' THEN
    RAISE EXCEPTION 'Leader email is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.leaders l
    WHERE l.campaign_id = _leader.campaign_id
      AND l.id <> _leader.id
      AND lower(l.invite_email) = lower(_leader.invite_email)
      AND l.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Another pending leader already uses this email';
  END IF;
  IF _leader.coordinator_id IS NULL AND public.is_coordinator() THEN
    UPDATE public.leaders SET coordinator_id = auth.uid(), updated_at = now() WHERE id = _leader.id;
  END IF;
  _token := gen_random_uuid();
  _expires := now() + interval '7 days';
  UPDATE public.user_invitations
  SET expires_at = now()
  WHERE lower(email) = lower(_leader.invite_email)
    AND campaign_id = _leader.campaign_id
    AND accepted_at IS NULL
    AND expires_at > now();
  INSERT INTO public.user_invitations(email, role, campaign_id, token, invited_by, expires_at)
  VALUES (lower(btrim(_leader.invite_email)), 'leader', _leader.campaign_id, _token, auth.uid(), _expires);
  RETURN QUERY SELECT _leader.id, _token, _expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_leader_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_leader_invitation(UUID) TO authenticated;