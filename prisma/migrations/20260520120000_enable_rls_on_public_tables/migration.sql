-- Enable Row-Level Security on every table in the public schema.
--
-- Why: the Supabase publishable key is exposed to the browser (it's loaded
-- via NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in lib/supabase/client.ts), which
-- means anyone with the site URL can hit Supabase's PostgREST API directly
-- and read/edit/delete any table that doesn't have RLS enabled. Supabase
-- flagged this as a critical issue.
--
-- How: enabling RLS without any policies = deny-all for non-superuser
-- connections like the `anon` role PostgREST uses. The app itself accesses
-- the database through Prisma via DATABASE_URL, which connects as the
-- `postgres` superuser and bypasses RLS — so server-side queries are
-- unaffected. The only client-side Supabase usage in the app is auth, not
-- data, so no policies are needed.
--
-- The DO block iterates every table in public so future tables added in
-- later migrations also get covered if this migration is ever re-run. It's
-- idempotent — ENABLE RLS on an already-RLS-enabled table is a no-op.
--
-- Note for future migrations: any NEW table added in a later migration
-- must include its own `ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;`
-- line, otherwise it will be publicly accessible until this migration is
-- manually re-run.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END$$;
