-- =============================================================================
-- HAYYIZ (حيز) - Supabase Security, RLS, Quota & Sync Optimization Migration
-- File: supabase-schema-and-security.sql
-- =============================================================================
-- This script contains all Database DDL, RLS policies, functions, triggers,
-- and server-side rate-limiting rules required for production deployment on Supabase.
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

-- 4. PRIVATE RATE-LIMITING SCHEMA FOR DATA API WRITE FLOOD PROTECTION
-- 4. PRIVATE RATE-LIMITING SCHEMA FOR POSTGREST DB-PRE-REQUEST PROTECTION
CREATE TABLE IF NOT EXISTS private.rate_limits (
    key TEXT PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON private.rate_limits (expires_at);

-- Core atomic transaction-safe rate-limiting function with strict search_path = ''
CREATE OR REPLACE FUNCTION private.check_rate_limit(
    p_key TEXT,
    p_max_attempts INT,
    p_window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Server-Side PostgREST db-pre-request Interceptor Function
-- Evaluates HTTP requests before query execution and sets response.status = '429' on limit breach
CREATE OR REPLACE FUNCTION private.pre_request()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    req_method TEXT;
    req_path TEXT;
    req_headers_json TEXT;
    client_ip TEXT := 'unknown';
    current_uid UUID;
    user_rate_allowed BOOLEAN := TRUE;
    ip_rate_allowed BOOLEAN := TRUE;
    headers_jsonb JSONB;
BEGIN
    -- Read GUC claims provided by PostgREST
    req_method := NULLIF(current_setting('request.method', TRUE), '');
    req_path   := NULLIF(current_setting('request.path', TRUE), '');
    req_headers_json := NULLIF(current_setting('request.headers', TRUE), '');
    current_uid := auth.uid();

    -- Extract client IP securely from PostgREST request.headers JSON via standard x-forwarded-for header
    IF req_headers_json IS NOT NULL THEN
        BEGIN
            headers_jsonb := req_headers_json::jsonb;
            client_ip := COALESCE(
                NULLIF(trim(split_part(headers_jsonb->>'x-forwarded-for', ',', 1)), ''),
                'unknown'
            );
        EXCEPTION WHEN OTHERS THEN
            client_ip := 'unknown';
        END;
    END IF;

    -- Intercept write HTTP operations (POST, PATCH, PUT, DELETE) targeting /sync_items
    IF req_method IN ('POST', 'PATCH', 'PUT', 'DELETE') AND (req_path IS NULL OR req_path LIKE '%sync_items%') THEN
        -- 1. Per-User Rate Limit: max 120 writes per 60s
        IF current_uid IS NOT NULL THEN
            user_rate_allowed := private.check_rate_limit('sync_write_user:' || current_uid::text, 120, 60);
        END IF;

        -- 2. Per-IP Rate Limit (Generous NAT-safe ceiling): max 300 writes per 60s per IP
        IF client_ip <> 'unknown' THEN
            ip_rate_allowed := private.check_rate_limit('sync_write_ip:' || client_ip, 300, 60);
        ELSE
            -- Fallback global unauthenticated flood limit if IP is unknown
            IF current_uid IS NULL THEN
                user_rate_allowed := private.check_rate_limit('sync_write_anon_global', 60, 60);
            END IF;
        END IF;

        IF NOT user_rate_allowed OR NOT ip_rate_allowed THEN
            -- Set GUC session configuration for PostgREST status and headers
            PERFORM set_config('response.status', '429', FALSE);
            PERFORM set_config('response.headers', '[{"Retry-After": "60"}]', FALSE);

            -- Raise PostgREST error using ERRCODE = 'PGRST' and JSON DETAIL payload for HTTP 429 status retention
            RAISE EXCEPTION 'Rate limit exceeded: Too many write requests to sync_items. Please wait before retrying.'
                USING ERRCODE = 'PGRST',
                      DETAIL = '{"status": 429, "status_text": "Too Many Requests", "headers": [{"Retry-After": "60"}]}',
                      HINT = 'HTTP 429 Too Many Requests';
        END IF;
    END IF;
END;
$$;

-- Register pre-request function in PostgREST configuration and reload config immediately
ALTER ROLE authenticator SET pgrst.db_pre_request = 'private.pre_request';
NOTIFY pgrst, 'reload config';

-- Lock down private schema permissions and grant required execution rights to authenticator role
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO authenticator;
GRANT EXECUTE ON FUNCTION private.pre_request() TO authenticator;
GRANT EXECUTE ON FUNCTION private.check_rate_limit(TEXT, INT, INT) TO authenticator;

-- 5. PAYLOAD, QUOTA & AUTHORIZATION TRIGGER (Data Invariants & Quota Enforcement)
CREATE OR REPLACE FUNCTION public.check_sync_item_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    max_payload_bytes CONSTANT INT := 102400; -- 100 KB limit per JSON item
    max_collection_items CONSTANT INT := 500;   -- Max 500 active items per tool collection
    current_count INT;
    is_existing_item BOOLEAN := FALSE;
    user_id_val UUID;
    tool_val TEXT;
    item_id_val TEXT;
    data_val JSONB;
BEGIN
    user_id_val := COALESCE(NEW.user_id, OLD.user_id);
    tool_val := COALESCE(NEW.tool, OLD.tool);
    item_id_val := COALESCE(NEW.item_id, OLD.item_id);

    -- 1. Force user_id to match authenticated user identity
    IF user_id_val IS NULL OR user_id_val <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Payload size validation for INSERT / UPDATE (100KB limit)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        data_val := NEW.data;
        IF octet_length(data_val::text) > max_payload_bytes THEN
            RAISE EXCEPTION 'Payload size exceeds the limit of 100KB for item % in tool %.', item_id_val, tool_val
                USING ERRCODE = '22026';
        END IF;
    END IF;

    -- 3. Collection Quota check for NEW insertions (active items count)
    IF TG_OP = 'INSERT' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.sync_items
            WHERE user_id = user_id_val AND tool = tool_val AND item_id = item_id_val
        ) INTO is_existing_item;

        IF NOT is_existing_item THEN
            SELECT COUNT(*) INTO current_count
            FROM public.sync_items
            WHERE user_id = user_id_val AND tool = tool_val AND deleted_at IS NULL;

            IF current_count >= max_collection_items THEN
                RAISE EXCEPTION 'Quota exceeded: Maximum allowed items (%) reached for tool %.', max_collection_items, tool_val
                    USING ERRCODE = '54000';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sync_item_limits ON public.sync_items;
CREATE TRIGGER trg_check_sync_item_limits
BEFORE INSERT OR UPDATE OR DELETE ON public.sync_items
FOR EACH ROW
EXECUTE FUNCTION public.check_sync_item_limits();

-- 6. AUTOMATED TOMBSTONE CLEANUP POLICY
CREATE OR REPLACE FUNCTION public.cleanup_old_tombstones(retention_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.sync_items
    WHERE deleted_at IS NOT NULL
      AND deleted_at < (NOW() - (retention_days || ' days')::INTERVAL);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_tombstones(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_tombstones(INT) TO service_role;

-- =============================================================================
-- 7. WORKSPACES, COLLABORATIVE TASKS & FOCUS SESSIONS SCHEMA
-- =============================================================================

-- 7.1 PROFILES TABLE & AUTH TRIGGER
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view co-members profiles" ON public.profiles;

-- Security helper functions to eliminate RLS recursion across tables
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'owner'
    ) OR EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = p_workspace_id AND created_by = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_task_member(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.task_members
        WHERE task_id = p_task_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT creator_id, workspace_id, scope INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    IF v_task.creator_id = p_user_id THEN RETURN TRUE; END IF;
    IF public.is_task_member(p_task_id, p_user_id) THEN RETURN TRUE; END IF;
    IF v_task.scope = 'workspace' AND v_task.workspace_id IS NOT NULL AND public.is_workspace_member(v_task.workspace_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Privacy-focused Profile RLS: Users can only read their own profile or profiles of members sharing a workspace or task
CREATE POLICY "Users can view co-members profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.workspace_members wm1
        JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
        WHERE wm1.user_id = auth.uid() AND wm2.user_id = public.profiles.id
    ) OR
    EXISTS (
        SELECT 1 FROM public.task_members tm1
        JOIN public.task_members tm2 ON tm1.task_id = tm2.task_id
        WHERE tm1.user_id = auth.uid() AND tm2.user_id = public.profiles.id
    )
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 7.2 WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NULL,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;


-- 7.3 WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Auto-add workspace creator as 'owner'
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_workspace_created ON public.workspaces;
CREATE TRIGGER trg_on_workspace_created
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();


-- 7.4 WORKSPACE RLS POLICIES (Recursion-free using helper functions)
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspace" ON public.workspaces;

CREATE POLICY "Members can view workspace"
ON public.workspaces FOR SELECT TO authenticated
USING (
    created_by = auth.uid() OR public.is_workspace_member(id, auth.uid())
);

CREATE POLICY "Users can create workspace"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update workspace"
ON public.workspaces FOR UPDATE TO authenticated
USING (public.is_workspace_owner(id, auth.uid()));

CREATE POLICY "Owners can delete workspace"
ON public.workspaces FOR DELETE TO authenticated
USING (public.is_workspace_owner(id, auth.uid()));


-- 7.5 WORKSPACE MEMBERS RLS POLICIES (Recursion-free)
DROP POLICY IF EXISTS "Members can view member list" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners or self can remove member" ON public.workspace_members;

CREATE POLICY "Members can view member list"
ON public.workspace_members FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid())
);

CREATE POLICY "Owners can add members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Owners or self can remove member"
ON public.workspace_members FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid())
);

-- Secure RPC function for inviting members by email without dumping email table
CREATE OR REPLACE FUNCTION public.add_workspace_member_by_email(p_workspace_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_target_user_id UUID;
    v_clean_email TEXT := lower(trim(p_email));
BEGIN
    -- Check if caller is owner
    IF NOT public.is_workspace_owner(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only workspace owners can invite members.'
            USING ERRCODE = '42501';
    END IF;

    -- Look up target user ID safely from profiles or auth.users
    SELECT id INTO v_target_user_id FROM public.profiles WHERE lower(email) = v_clean_email;

    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم غير موجود بهذا البريد الإلكتروني');
    END IF;

    -- Check duplicate member
    IF public.is_workspace_member(p_workspace_id, v_target_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم عضو بالفعل في هذه المساحة');
    END IF;

    -- Insert new member
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_target_user_id, 'member');

    RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id, 'message', 'تمت إضافة العضو بنجاح');
END;
$$;


-- 7.6 SYNCHRONIZED & COLLABORATIVE TASKS TABLE (with DB Constraints)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NULL,
    scope TEXT NOT NULL DEFAULT 'me' CHECK (scope IN ('me', 'specific_users', 'workspace')),
    completion_mode TEXT NOT NULL DEFAULT 'independent' CHECK (completion_mode IN ('independent', 'collaborative')),
    due_date TIMESTAMPTZ NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_scope_workspace CHECK ((scope = 'workspace' AND workspace_id IS NOT NULL) OR (scope <> 'workspace')),
    CONSTRAINT chk_task_scope_me CHECK ((scope = 'me' AND workspace_id IS NULL) OR (scope <> 'me'))
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;


-- 7.7 TASK MEMBERS TABLE (Explicit Task Visibility / Assignment)
CREATE TABLE IF NOT EXISTS public.task_members (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'assignee',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.task_members ENABLE ROW LEVEL SECURITY;

-- Auto-add creator to task_members
CREATE OR REPLACE FUNCTION public.handle_new_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.task_members (task_id, user_id, role)
    VALUES (NEW.id, NEW.creator_id, 'creator')
    ON CONFLICT (task_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_task_created ON public.tasks;
CREATE TRIGGER trg_on_task_created
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_new_task();


-- 7.8 TASK PROGRESS TABLE (Independent Task Completion per User)
CREATE TABLE IF NOT EXISTS public.task_progress (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;


-- 7.9 TASKS RLS POLICIES (Recursion-free)
DROP POLICY IF EXISTS "Users can view permitted tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authorized users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators or workspace owners can delete tasks" ON public.tasks;

CREATE POLICY "Users can view permitted tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
    public.can_view_task(id, auth.uid())
);

CREATE POLICY "Users can create tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
    creator_id = auth.uid() AND
    (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
);

CREATE POLICY "Authorized users can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
    public.can_view_task(id, auth.uid())
);

CREATE POLICY "Creators or workspace owners can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
    creator_id = auth.uid() OR
    (workspace_id IS NOT NULL AND public.is_workspace_owner(workspace_id, auth.uid()))
);


-- 7.10 TASK MEMBERS RLS POLICIES
DROP POLICY IF EXISTS "Task viewers can read task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can manage task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can remove task members" ON public.task_members;

CREATE POLICY "Task viewers can read task members"
ON public.task_members FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR public.can_view_task(task_id, auth.uid())
);

CREATE POLICY "Task creators can manage task members"
ON public.task_members FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid())
);

CREATE POLICY "Task creators can remove task members"
ON public.task_members FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid())
);


-- 7.11 TASK PROGRESS RLS POLICIES
DROP POLICY IF EXISTS "Task viewers can read task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can update own task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can insert own task progress" ON public.task_progress;

CREATE POLICY "Task viewers can read task progress"
ON public.task_progress FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR public.can_view_task(task_id, auth.uid())
);

CREATE POLICY "Users can insert own task progress"
ON public.task_progress FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() AND public.can_view_task(task_id, auth.uid())
);

CREATE POLICY "Users can update own task progress"
ON public.task_progress FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() AND public.can_view_task(task_id, auth.uid())
)
WITH CHECK (
    user_id = auth.uid() AND public.can_view_task(task_id, auth.uid())
);


-- 7.12 FOCUS SESSIONS TABLE (Linked Focus Sessions for Tasks & Workspaces)
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NULL REFERENCES public.tasks(id) ON DELETE SET NULL,
    workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view permitted focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can insert own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can update own focus sessions" ON public.focus_sessions;

CREATE POLICY "Users can view permitted focus sessions"
ON public.focus_sessions FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    (
        task_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_id AND (
                t.creator_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.task_members tm WHERE tm.task_id = t.id AND tm.user_id = auth.uid()) OR
                (t.scope = 'workspace' AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = t.workspace_id AND wm.user_id = auth.uid()))
            )
        )
    ) OR
    (
        workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.focus_sessions.workspace_id AND wm.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can insert own focus sessions"
ON public.focus_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own focus sessions"
ON public.focus_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 7.13 INDEXES FOR FAST WORKSPACE & TASK QUERIES
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_members_user ON public.task_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_task ON public.task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_task ON public.focus_sessions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_workspace ON public.focus_sessions(workspace_id) WHERE workspace_id IS NOT NULL;


-- 7.14 REALTIME PUBLICATION ENABLING
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces, public.workspace_members, public.tasks, public.task_members, public.task_progress, public.focus_sessions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or restricted
    NULL;
END;
$$;
