-- =============================================================================
-- HAYYIZ (حيز) - Supabase Security, RLS, Quota & Sync Optimization Migration
-- File: supabase-schema-and-security.sql
-- =============================================================================
-- This script contains all Database DDL, RLS policies, functions, triggers,
-- and server-side rate-limiting RPCs required for production deployment on Supabase.
--
-- Execute this script directly in the Supabase Dashboard SQL Editor.
-- =============================================================================

-- 1. SCHEMAS & EXTENSIONS
CREATE SCHEMA IF NOT EXISTS private;

-- 2. MAIN SYNC TABLE STRUCTURE
CREATE TABLE IF NOT EXISTS public.sync_items (
    user_id UUID NOT NULL DEFAULT auth.uid(),
    tool TEXT NOT NULL,
    item_id TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL DEFAULT NULL,
    PRIMARY KEY (user_id, tool, item_id)
);

-- Optimize queries for incremental sync and RLS lookups
CREATE INDEX IF NOT EXISTS idx_sync_items_user_tool_updated
ON public.sync_items (user_id, tool, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_items_user_tool_deleted
ON public.sync_items (user_id, tool, deleted_at)
WHERE deleted_at IS NOT NULL;

-- 3. STRICT ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.sync_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete own sync items" ON public.sync_items;

-- Policy 1: SELECT - Users can only read their own sync items
CREATE POLICY "Users can read own sync items"
ON public.sync_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: INSERT - Users can only insert items with their own user_id
CREATE POLICY "Users can insert own sync items"
ON public.sync_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE - Users can only update their own items, and user_id cannot be changed
CREATE POLICY "Users can update own sync items"
ON public.sync_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE - Users can only delete their own sync items
CREATE POLICY "Users can delete own sync items"
ON public.sync_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. PAYLOAD & QUOTA ENFORCEMENT (Data Swelling Prevention)
-- Function to validate item payload size and max items quota per user & tool
CREATE OR REPLACE FUNCTION public.check_sync_item_limits()
RETURNS TRIGGER AS $$
DECLARE
    max_payload_bytes CONSTANT INT := 102400; -- 100 KB limit per JSON item
    max_collection_items CONSTANT INT := 500;   -- Max 500 active items per tool collection
    current_count INT;
    is_existing_item BOOLEAN := FALSE;
BEGIN
    -- Force user_id to match authenticated user
    IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
            USING ERRCODE = '42501';
    END IF;

    -- Payload size validation (100KB limit)
    IF octet_length(NEW.data::text) > max_payload_bytes THEN
        RAISE EXCEPTION 'Payload size exceeds the limit of 100KB for item % in tool %.', NEW.item_id, NEW.tool
            USING ERRCODE = '22026';
    END IF;

    -- Quota check for NEW insertions (active items count)
    IF TG_OP = 'INSERT' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.sync_items
            WHERE user_id = NEW.user_id AND tool = NEW.tool AND item_id = NEW.item_id
        ) INTO is_existing_item;

        IF NOT is_existing_item THEN
            SELECT COUNT(*) INTO current_count
            FROM public.sync_items
            WHERE user_id = NEW.user_id AND tool = NEW.tool AND deleted_at IS NULL;

            IF current_count >= max_collection_items THEN
                RAISE EXCEPTION 'Quota exceeded: Maximum allowed items (%) reached for tool %.', max_collection_items, NEW.tool
                    USING ERRCODE = '54000';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_sync_item_limits ON public.sync_items;
CREATE TRIGGER trg_check_sync_item_limits
BEFORE INSERT OR UPDATE ON public.sync_items
FOR EACH ROW
EXECUTE FUNCTION public.check_sync_item_limits();

-- 5. AUTOMATED TOMBSTONE CLEANUP POLICY
CREATE OR REPLACE FUNCTION public.cleanup_old_tombstones(retention_days INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.sync_items
    WHERE deleted_at IS NOT NULL
      AND deleted_at < (NOW() - (retention_days || ' days')::INTERVAL);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.cleanup_old_tombstones(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_tombstones(INT) TO service_role;

-- 6. PRIVATE RATE-LIMITING SCHEMA & SERVER-SIDE RPC
CREATE TABLE IF NOT EXISTS private.rate_limits (
    key TEXT PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON private.rate_limits (expires_at);

-- Core internal rate-limiting function
CREATE OR REPLACE FUNCTION private.check_rate_limit(
    p_key TEXT,
    p_max_attempts INT,
    p_window_seconds INT
) RETURNS BOOLEAN AS $$
DECLARE
    rec RECORD;
    now_ts TIMESTAMPTZ := NOW();
BEGIN
    -- Cleanup expired entries periodically
    DELETE FROM private.rate_limits WHERE expires_at < now_ts;

    SELECT * INTO rec FROM private.rate_limits WHERE key = p_key FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO private.rate_limits (key, attempts, window_start, expires_at)
        VALUES (p_key, 1, now_ts, now_ts + (p_window_seconds || ' seconds')::INTERVAL);
        RETURN TRUE;
    ELSIF rec.expires_at < now_ts THEN
        UPDATE private.rate_limits
        SET attempts = 1, window_start = now_ts, expires_at = now_ts + (p_window_seconds || ' seconds')::INTERVAL
        WHERE key = p_key;
        RETURN TRUE;
    ELSIF rec.attempts < p_max_attempts THEN
        UPDATE private.rate_limits
        SET attempts = rec.attempts + 1
        WHERE key = p_key;
        RETURN TRUE;
    ELSE
        RETURN FALSE; -- Rate limit exceeded
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock down access to private schema
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- Server-Side Public RPC Callable by Anonymous / Authenticated Clients before Auth actions
-- Inspects trusted HTTP headers (x-forwarded-for, cf-connecting-ip) injected by Edge / Cloudflare proxy
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
    action_type TEXT DEFAULT 'signup',
    max_attempts INT DEFAULT 1,
    window_seconds INT DEFAULT 600
) RETURNS JSONB AS $$
DECLARE
    client_ip TEXT;
    headers_json JSONB;
    rate_key TEXT;
    allowed BOOLEAN;
BEGIN
    BEGIN
        headers_json := NULLIF(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        headers_json := '{}'::jsonb;
    END;

    -- Extract client IP safely from trusted proxy headers or fallback
    client_ip := COALESCE(
        headers_json->>'cf-connecting-ip',
        split_part(headers_json->>'x-forwarded-for', ',', 1),
        'unknown_client'
    );

    rate_key := 'ip_rate:' || action_type || ':' || trim(client_ip);

    allowed := private.check_rate_limit(rate_key, max_attempts, window_seconds);

    IF NOT allowed THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'message', 'rate_limit_exceeded',
            'client_ip', client_ip
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'client_ip', client_ip
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(TEXT, INT, INT) TO anon, authenticated;
