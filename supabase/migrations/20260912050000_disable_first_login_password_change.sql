-- Google is the primary login flow. Keep the legacy profile column for
-- backwards compatibility, but clear the first-login password-change flag
-- for the existing Super Admin account so it can never block sign-in.
UPDATE public.profiles p
SET must_change_password = false,
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('henriquedouglas51@gmail.com');
