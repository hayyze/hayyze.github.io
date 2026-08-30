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

-- =============================================================================
-- 2. MAIN SYNC TABLE STRUCTURE & POLICIES
-- =============================================================================
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

-- STRICT ROW LEVEL SECURITY (RLS) POLICIES FOR SYNC_ITEMS
ALTER TABLE public.sync_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete own sync items" ON public.sync_items;

CREATE POLICY "Users can read own sync items"
ON public.sync_items FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync items"
ON public.sync_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync items"
ON public.sync_items FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync items"
ON public.sync_items FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- PAYLOAD, QUOTA & AUTHORIZATION TRIGGER (Data Invariants & Quota Enforcement)
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

    -- Enforce user_id matching for authenticated users, but allow service_role administrative cleanup
    IF auth.role() <> 'service_role' THEN
        IF user_id_val IS NULL OR user_id_val <> auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        data_val := NEW.data;
        IF octet_length(data_val::text) > max_payload_bytes THEN
            RAISE EXCEPTION 'Payload size exceeds the limit of 100KB for item % in tool %.', item_id_val, tool_val
                USING ERRCODE = '22026';
        END IF;
    END IF;

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

-- AUTOMATED TOMBSTONE CLEANUP POLICY
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

-- =============================================================================
-- 3. PRIVATE RATE-LIMITING SCHEMA FOR POSTGREST PROTECTION
-- =============================================================================
CREATE TABLE IF NOT EXISTS private.rate_limits (
    key TEXT PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ENABLE RLS ON PRIVATE RATE LIMITS TABLE (FAILS CLOSED FOR DIRECT CLIENT API QUERIES)
ALTER TABLE private.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON private.rate_limits (expires_at);

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
        RETURN FALSE;
    END IF;
END;
$$;

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
    req_method := NULLIF(current_setting('request.method', TRUE), '');
    req_path   := NULLIF(current_setting('request.path', TRUE), '');
    req_headers_json := NULLIF(current_setting('request.headers', TRUE), '');
    current_uid := auth.uid();

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

    IF req_method IN ('POST', 'PATCH', 'PUT', 'DELETE') AND (req_path IS NULL OR req_path LIKE '%sync_items%') THEN
        IF current_uid IS NOT NULL THEN
            user_rate_allowed := private.check_rate_limit('sync_write_user:' || current_uid::text, 120, 60);
        END IF;

        IF client_ip <> 'unknown' THEN
            ip_rate_allowed := private.check_rate_limit('sync_write_ip:' || client_ip, 300, 60);
        ELSE
            IF current_uid IS NULL THEN
                user_rate_allowed := private.check_rate_limit('sync_write_anon_global', 60, 60);
            END IF;
        END IF;

        IF NOT user_rate_allowed OR NOT ip_rate_allowed THEN
            PERFORM set_config('response.status', '429', FALSE);
            PERFORM set_config('response.headers', '[{"Retry-After": "60"}]', FALSE);

            RAISE EXCEPTION 'Rate limit exceeded: Too many write requests to sync_items. Please wait before retrying.'
                USING ERRCODE = 'PGRST',
                      DETAIL = '{"status": 429, "status_text": "Too Many Requests", "headers": [{"Retry-After": "60"}]}',
                      HINT = 'HTTP 429 Too Many Requests';
        END IF;
    END IF;
END;
$$;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'private.pre_request';
NOTIFY pgrst, 'reload config';

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO authenticator;
GRANT EXECUTE ON FUNCTION private.pre_request() TO authenticator;
GRANT EXECUTE ON FUNCTION private.check_rate_limit(TEXT, INT, INT) TO authenticator;


-- =============================================================================
-- 4. WORKSPACES, COLLABORATIVE TASKS & FOCUS SESSIONS BASE TABLES
-- (CREATED FIRST BEFORE ANY FUNCTIONS, TRIGGERS OR POLICIES REFERENCE THEM)
-- =============================================================================

-- 4.1 PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NULL,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.3 WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- 4.4 SYNCHRONIZED & COLLABORATIVE TASKS TABLE
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
    CONSTRAINT chk_task_scope_specific CHECK ((scope = 'specific_users' AND workspace_id IS NOT NULL) OR (scope <> 'specific_users')),
    CONSTRAINT chk_task_scope_me CHECK ((scope = 'me' AND workspace_id IS NULL) OR (scope <> 'me'))
);

-- 4.5 TASK MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.task_members (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'assignee',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

-- 4.6 TASK PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.task_progress (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

-- 4.7 FOCUS SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NULL REFERENCES public.tasks(id) ON DELETE SET NULL,
    workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_focus_session_timestamps CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Enable RLS on all workspaces tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- INDEXES FOR FAST WORKSPACE & TASK QUERIES
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_members_user ON public.task_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_task ON public.task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_task ON public.focus_sessions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_workspace ON public.focus_sessions(workspace_id) WHERE workspace_id IS NOT NULL;


-- =============================================================================
-- 5. SECURITY HELPER FUNCTIONS
-- (CREATED AFTER BASE TABLES EXIST TO ELIMINATE DEPENDENCY ERRORS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
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
STABLE
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
STABLE
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
STABLE
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

CREATE OR REPLACE FUNCTION public.recalculate_collaborative_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task RECORD;
    v_total_required INT := 0;
    v_completed_count INT := 0;
    v_is_fully_completed BOOLEAN := FALSE;
    v_now_iso TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    IF v_task.completion_mode <> 'collaborative' THEN
        RETURN v_task.completed;
    END IF;

    IF v_task.scope IN ('specific_users', 'me') THEN
        SELECT COUNT(DISTINCT user_id) INTO v_total_required
        FROM public.task_members WHERE task_id = p_task_id;
    ELSIF v_task.scope = 'workspace' AND v_task.workspace_id IS NOT NULL THEN
        SELECT COUNT(DISTINCT user_id) INTO v_total_required
        FROM public.workspace_members WHERE workspace_id = v_task.workspace_id;
    ELSE
        v_total_required := 1;
    END IF;

    IF v_total_required < 1 THEN v_total_required := 1; END IF;

    IF v_task.scope IN ('specific_users', 'me') THEN
        SELECT COUNT(DISTINCT tp.user_id) INTO v_completed_count
        FROM public.task_progress tp
        JOIN public.task_members tm ON tp.task_id = tm.task_id AND tp.user_id = tm.user_id
        WHERE tp.task_id = p_task_id AND tp.completed = TRUE;
    ELSIF v_task.scope = 'workspace' AND v_task.workspace_id IS NOT NULL THEN
        SELECT COUNT(DISTINCT tp.user_id) INTO v_completed_count
        FROM public.task_progress tp
        JOIN public.workspace_members wm ON v_task.workspace_id = wm.workspace_id AND tp.user_id = wm.user_id
        WHERE tp.task_id = p_task_id AND tp.completed = TRUE;
    ELSE
        SELECT COUNT(DISTINCT user_id) INTO v_completed_count
        FROM public.task_progress
        WHERE task_id = p_task_id AND completed = TRUE;
    END IF;

    v_is_fully_completed := (v_completed_count >= v_total_required);

    UPDATE public.tasks
    SET completed = v_is_fully_completed,
        completed_at = CASE WHEN v_is_fully_completed THEN v_now_iso ELSE NULL END,
        updated_at = v_now_iso
    WHERE id = p_task_id;

    RETURN v_is_fully_completed;
END;
$$;


-- =============================================================================
-- 6. TRIGGERS & TRIGGER FUNCTIONS
-- =============================================================================

-- Profile Sync Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email TEXT := COALESCE(NEW.email, '');
BEGIN
    INSERT INTO public.profiles (id, email, display_name, updated_at)
    VALUES (
        NEW.id,
        v_email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NULLIF(split_part(v_email, '@', 1), ''), 'طالب'),
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

-- Workspace Creator Owner Trigger Function
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

-- Task Creator Member Trigger Function
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

-- Member Removal Recalculation Trigger Function
CREATE OR REPLACE FUNCTION public.handle_member_removal_recalculate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    r_task RECORD;
BEGIN
    IF TG_TABLE_NAME = 'task_members' THEN
        PERFORM public.recalculate_collaborative_task(OLD.task_id);
    ELSIF TG_TABLE_NAME = 'workspace_members' THEN
        FOR r_task IN SELECT id FROM public.tasks WHERE workspace_id = OLD.workspace_id AND completion_mode = 'collaborative' LOOP
            PERFORM public.recalculate_collaborative_task(r_task.id);
        END LOOP;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_on_task_member_delete ON public.task_members;
CREATE TRIGGER trg_recalculate_on_task_member_delete
AFTER DELETE ON public.task_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal_recalculate();

DROP TRIGGER IF EXISTS trg_recalculate_on_workspace_member_delete ON public.workspace_members;
CREATE TRIGGER trg_recalculate_on_workspace_member_delete
AFTER DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal_recalculate();

-- Task Member Validation Trigger Function
CREATE OR REPLACE FUNCTION public.validate_task_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT creator_id, workspace_id, scope INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.' USING ERRCODE = '22000';
    END IF;

    IF v_task.workspace_id IS NOT NULL AND NOT public.is_workspace_member(v_task.workspace_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Invalid task member: User % is not a member of workspace %.', NEW.user_id, v_task.workspace_id
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_member ON public.task_members;
CREATE TRIGGER trg_validate_task_member
BEFORE INSERT OR UPDATE ON public.task_members
FOR EACH ROW EXECUTE FUNCTION public.validate_task_member_insert();

-- Focus Session Validation Trigger Function
CREATE OR REPLACE FUNCTION public.validate_focus_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task_ws_id UUID;
BEGIN
    IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.duration_seconds < 0 OR NEW.duration_seconds > 86400 THEN
        RAISE EXCEPTION 'Invalid duration_seconds: must be between 0 and 86400 seconds.'
            USING ERRCODE = '22023';
    END IF;

    IF NEW.task_id IS NOT NULL THEN
        IF NOT public.can_view_task(NEW.task_id, NEW.user_id) THEN
            RAISE EXCEPTION 'Unauthorized: User does not have access to specified task.'
                USING ERRCODE = '42501';
        END IF;

        SELECT workspace_id INTO v_task_ws_id FROM public.tasks WHERE id = NEW.task_id;

        IF NEW.workspace_id IS NOT NULL AND v_task_ws_id IS NOT NULL AND NEW.workspace_id <> v_task_ws_id THEN
            RAISE EXCEPTION 'Mismatch: task_id does not belong to specified workspace_id.'
                USING ERRCODE = '22000';
        END IF;
    END IF;

    IF NEW.workspace_id IS NOT NULL THEN
        IF NOT public.is_workspace_member(NEW.workspace_id, NEW.user_id) THEN
            RAISE EXCEPTION 'Unauthorized: User is not a member of specified workspace.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_focus_session ON public.focus_sessions;
CREATE TRIGGER trg_validate_focus_session
BEFORE INSERT OR UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_focus_session();


-- =============================================================================
-- 7. USER-CALLABLE PUBLIC RPC ENDPOINTS
-- =============================================================================

-- Atomic RPC Function: create_synchronized_task
-- Signature: public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[])
CREATE OR REPLACE FUNCTION public.create_synchronized_task(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_scope TEXT DEFAULT 'me',
    p_completion_mode TEXT DEFAULT 'independent',
    p_workspace_id UUID DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_recipient_user_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_creator_id UUID := auth.uid();
    v_task_id UUID;
    v_target_u_id UUID;
    v_clean_title TEXT := trim(p_title);
    v_task RECORD;
BEGIN
    IF v_creator_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_title IS NULL OR v_clean_title = '' THEN
        RAISE EXCEPTION 'Invalid argument: Task title is required.' USING ERRCODE = '22023';
    END IF;

    IF p_scope NOT IN ('me', 'specific_users', 'workspace') THEN
        RAISE EXCEPTION 'Invalid scope: %.', p_scope USING ERRCODE = '22023';
    END IF;

    IF p_completion_mode NOT IN ('independent', 'collaborative') THEN
        RAISE EXCEPTION 'Invalid completion_mode: %.', p_completion_mode USING ERRCODE = '22023';
    END IF;

    IF p_scope = 'workspace' THEN
        IF p_workspace_id IS NULL THEN
            RAISE EXCEPTION 'Invalid workspace scope: workspace_id is required.' USING ERRCODE = '22023';
        END IF;
        IF NOT public.is_workspace_member(p_workspace_id, v_creator_id) THEN
            RAISE EXCEPTION 'Unauthorized: Creator is not a member of workspace.' USING ERRCODE = '42501';
        END IF;
    ELSIF p_scope = 'me' THEN
        IF p_workspace_id IS NOT NULL THEN
            RAISE EXCEPTION 'Invalid scope "me": workspace_id must be null.' USING ERRCODE = '22023';
        END IF;
    ELSIF p_scope = 'specific_users' THEN
        IF p_workspace_id IS NULL THEN
            RAISE EXCEPTION 'Invalid specific_users scope: workspace_id is required.' USING ERRCODE = '22023';
        END IF;
        IF NOT public.is_workspace_member(p_workspace_id, v_creator_id) THEN
            RAISE EXCEPTION 'Unauthorized: Creator is not a member of specified workspace.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 1. Insert task row
    INSERT INTO public.tasks (
        creator_id,
        workspace_id,
        title,
        description,
        scope,
        completion_mode,
        due_date
    )
    VALUES (
        v_creator_id,
        p_workspace_id,
        v_clean_title,
        p_description,
        p_scope,
        p_completion_mode,
        p_due_date
    )
    RETURNING id INTO v_task_id;

    -- 2. Insert additional specific users if scope = specific_users
    IF p_scope = 'specific_users' AND p_recipient_user_ids IS NOT NULL AND array_length(p_recipient_user_ids, 1) > 0 THEN
        FOREACH v_target_u_id IN ARRAY p_recipient_user_ids LOOP
            IF v_target_u_id IS NOT NULL AND v_target_u_id <> v_creator_id THEN
                IF p_workspace_id IS NOT NULL AND NOT public.is_workspace_member(p_workspace_id, v_target_u_id) THEN
                    RAISE EXCEPTION 'Invalid recipient: User % is not a member of workspace %.', v_target_u_id, p_workspace_id
                        USING ERRCODE = '42501';
                END IF;

                INSERT INTO public.task_members (task_id, user_id, role)
                VALUES (v_task_id, v_target_u_id, 'assignee')
                ON CONFLICT (task_id, user_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_task_id;

    RETURN jsonb_build_object(
        'success', true,
        'task', row_to_json(v_task)
    );
END;
$$;

-- Atomic RPC Function: add_workspace_member_by_email
-- Signature: public.add_workspace_member_by_email(UUID, TEXT)
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
    IF NOT public.is_workspace_owner(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only workspace owners can invite members.'
            USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_target_user_id FROM public.profiles WHERE lower(email) = v_clean_email;

    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم غير موجود بهذا البريد الإلكتروني');
    END IF;

    IF v_target_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'لا يمكنك دعوة نفسك');
    END IF;

    IF public.is_workspace_member(p_workspace_id, v_target_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم عضو بالفعل في هذه المساحة');
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_target_user_id, 'member');

    RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id, 'message', 'تمت إضافة العضو بنجاح');
END;
$$;

-- Atomic RPC Function: set_task_progress_and_recalculate
-- Signature: public.set_task_progress_and_recalculate(UUID, BOOLEAN)
CREATE OR REPLACE FUNCTION public.set_task_progress_and_recalculate(
    p_task_id UUID,
    p_completed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_task RECORD;
    v_now_iso TIMESTAMPTZ := NOW();
    v_is_fully_completed BOOLEAN := FALSE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT public.can_view_task(p_task_id, v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Task permission denied.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;

    -- 1. Upsert caller's task progress
    INSERT INTO public.task_progress (task_id, user_id, completed, completed_at, updated_at)
    VALUES (p_task_id, v_caller_id, p_completed, CASE WHEN p_completed THEN v_now_iso ELSE NULL END, v_now_iso)
    ON CONFLICT (task_id, user_id) DO UPDATE
    SET completed = EXCLUDED.completed,
        completed_at = EXCLUDED.completed_at,
        updated_at = EXCLUDED.updated_at;

    -- 2. If collaborative mode, calculate exact group completion
    IF v_task.completion_mode = 'collaborative' THEN
        v_is_fully_completed := public.recalculate_collaborative_task(p_task_id);
    ELSE
        v_is_fully_completed := p_completed;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'user_completed', p_completed,
        'collaborative', (v_task.completion_mode = 'collaborative'),
        'is_fully_completed', v_is_fully_completed
    );
END;
$$;


-- =============================================================================
-- 8. RLS POLICIES FOR WORKSPACES, TASKS & FOCUS SESSIONS
-- =============================================================================

-- 8.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view co-members profiles" ON public.profiles;

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

-- 8.2 WORKSPACE POLICIES
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

-- 8.3 WORKSPACE MEMBERS POLICIES
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

-- 8.4 TASKS POLICIES
DROP POLICY IF EXISTS "Users can view permitted tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authorized users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators or workspace owners can update tasks" ON public.tasks;
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

CREATE POLICY "Creators or workspace owners can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
    creator_id = auth.uid() OR
    (workspace_id IS NOT NULL AND public.is_workspace_owner(workspace_id, auth.uid()))
);

CREATE POLICY "Creators or workspace owners can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
    creator_id = auth.uid() OR
    (workspace_id IS NOT NULL AND public.is_workspace_owner(workspace_id, auth.uid()))
);

-- 8.5 TASK MEMBERS POLICIES
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

-- 8.6 TASK PROGRESS POLICIES
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

-- 8.7 FOCUS SESSIONS POLICIES
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


-- =============================================================================
-- 9. LEAST PRIVILEGE FUNCTION EXECUTION GRANTS & REVOKES
-- =============================================================================

-- Revoke execution rights on internal helper functions from PUBLIC, anon, AND authenticated
REVOKE ALL ON FUNCTION public.check_sync_item_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_task_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_collaborative_task(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_member_removal_recalculate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_task() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_task_member_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_focus_session() FROM PUBLIC, anon, authenticated;

-- Revoke and grant execution rights for user-callable public RPC endpoints
REVOKE ALL ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_tombstones(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_tombstones(INT) TO service_role;


-- =============================================================================
-- 10. REALTIME PUBLICATION & POSTGREST SCHEMA CACHE RELOAD
-- =============================================================================

DO $$
DECLARE
    t_name TEXT;
    t_array TEXT[] := ARRAY['workspaces', 'workspace_members', 'tasks', 'task_members', 'task_progress', 'focus_sessions'];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH t_name IN ARRAY t_array LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t_name
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t_name);
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- Force PostgREST schema cache reload immediately after migration completes
NOTIFY pgrst, 'reload schema';
