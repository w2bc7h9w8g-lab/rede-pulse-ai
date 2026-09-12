# Auth/security audit — 2026-09-12

## Verified

- `henriquedouglas51@gmail.com` exists in Supabase Auth, is confirmed, has role `superadmin`, and has `must_change_password = true`.
- OAuth/email callback route exists at `/auth/callback` and handles PKCE `code` and email `token_hash` flows.
- Super Admin bypasses campaign onboarding in the authenticated route.
- Campaign/network/analysis RLS is tenant/leader scoped through the `private` security functions.
- Instagram connection SELECT policy was too broad for leaders and exposed connection metadata; it is hardened in the new migration.
- Generic profile updates could change authoritative fields such as `campaign_id` or `must_change_password`; the new migration restricts those fields.
- First-login password completion now uses a dedicated authenticated RPC instead of updating the authorization flag directly from the browser.

## Important external configuration

Google OAuth provider credentials and allowed redirect URLs are external Supabase/Lovable configuration. They cannot be fixed solely by repository code. The app now has a callback implementation, but the provider must allow the preview/production callback URLs.

## Not changed yet

The Meta/Instagram provider remains intentionally pluggable and does not claim complete individual likes. The MVP should continue to use the provider capabilities already implemented until a liker provider is validated independently.
