CREATE OR REPLACE FUNCTION public.create_campaign_for_current_user(
  _name text,
  _candidate_name text DEFAULT NULL,
  _instagram_username text DEFAULT NULL,
  _is_demo boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _campaign_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF coalesce(btrim(_name), '') = '' THEN
    RAISE EXCEPTION 'campaign name is required';
  END IF;

  PERFORM public.ensure_profile(NULL);

  SELECT campaign_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'user already belongs to a campaign';
  END IF;

  INSERT INTO public.campaigns (name, candidate_name, instagram_username, is_demo)
  VALUES (btrim(_name), nullif(btrim(coalesce(_candidate_name,'')), ''),
          nullif(btrim(coalesce(_instagram_username,'')), ''), coalesce(_is_demo, false))
  RETURNING id INTO _campaign_id;

  UPDATE public.profiles SET campaign_id = _campaign_id, updated_at = now() WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, campaign_id)
  VALUES (_uid, 'coordinator', _campaign_id)
  ON CONFLICT (user_id, role) DO UPDATE SET campaign_id = EXCLUDED.campaign_id;

  RETURN _campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_campaign_for_current_user(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_campaign_for_current_user(text, text, text, boolean) TO authenticated;