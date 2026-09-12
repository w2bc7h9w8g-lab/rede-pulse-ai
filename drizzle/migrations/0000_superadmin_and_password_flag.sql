ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ensure_profile(_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- papel de plataforma (super admin) para a conta titular
  IF _email IS NOT NULL AND lower(_email) = 'henriquedouglas51@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'superadmin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- vincula convite de líder pendente por e-mail
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
END; $function$;