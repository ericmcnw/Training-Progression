# Supabase Auth Setup

This repo now includes the first Supabase Auth integration pass.

## What is already wired

1. SSR Supabase clients under `lib/supabase/`
2. Session refresh in `middleware.ts`
3. Email magic-link sign-in page at `/signin`
4. Confirmation handler at `/auth/confirm`
5. `lib/auth.ts` now attempts to resolve the current user from Supabase when `PROGRESSION_AUTH_MODE="authenticated"`

## What you need to configure in Supabase

### 1. Add environment variables

Put these in your local `.env` or `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
APP_URL=http://localhost:3000
PROGRESSION_AUTH_MODE=authenticated
```

Keep `DATABASE_URL` and `DIRECT_URL` as they are for Prisma.

### 2. Configure Auth URL settings

In the Supabase dashboard:

1. Go to `Authentication` -> `URL Configuration`
2. Set `Site URL` to your app URL
   Local: `http://localhost:3000`
3. Add redirect URLs for:
   - `http://localhost:3000/auth/confirm`
   - your future production domain, for example `https://your-domain.com/auth/confirm`

### 3. Update the email template for SSR magic links

In the Supabase dashboard:

1. Go to `Authentication` -> `Email Templates`
2. Update the confirmation / magic-link template so it includes `token_hash`

Use this pattern:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
```

Without this, the server-side confirmation route will not be able to exchange the link for a session cookie.

## Current behavior

1. If `PROGRESSION_AUTH_MODE=single-user-dev`, the app keeps its current local behavior.
2. If `PROGRESSION_AUTH_MODE=authenticated`, `lib/auth.ts` will attempt to resolve the current Supabase user.
3. The app is not globally protected yet.
   That should happen only after owned tables have `userId` and app queries are scoped correctly.

## Recommended next backend step

1. Add a local `User` model that maps to `auth.users.id`
2. Add nullable `userId` columns to owned app tables
3. Backfill your current data into one bootstrap user
4. Start converting queries and actions to `where: { ..., userId }`
