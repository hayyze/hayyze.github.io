-- Minimal Supabase Auth contract for an empty, disposable PostgreSQL 17 test database.
-- Never run this bootstrap against a Supabase project or an existing application database.
-- Apply this file, the root schema, the targeted migration, then test-database-security.sql
-- with psql -v ON_ERROR_STOP=1. It intentionally contains no user data or credentials.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
GRANT anon, authenticated, service_role TO authenticator;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aud TEXT,
    role TEXT,
    email TEXT,
    email_confirmed_at TIMESTAMPTZ,
    raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'
    )::uuid;
$$;

CREATE FUNCTION auth.role()
RETURNS TEXT LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
    );
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role, authenticator;
-- Keep auth.users private, as it is on Supabase; trusted public trigger/RPC functions own access.
REVOKE ALL ON auth.users FROM PUBLIC, anon, authenticated;
