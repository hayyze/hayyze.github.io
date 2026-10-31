-- Hayyiz security hardening: atomic per-account RPC limits and profile privacy.
-- Additive migration; no existing rows, workspaces, tasks or sessions are deleted.
-- Review this migration against scripts/test-database-security.sql before deployment.

CREATE OR REPLACE FUNCTION private.check_rate_limit(
    p_key TEXT,
    p_max_attempts INT,
    p_window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    now_ts TIMESTAMPTZ := NOW();
    current_attempts INT;
BEGIN
    IF p_key IS NULL OR length(p_key) > 200
       OR p_max_attempts < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
        RETURN FALSE;
    END IF;

    DELETE FROM private.rate_limits WHERE expires_at < now_ts;

    -- Atomic fixed-window counter. The previous SELECT FOR UPDATE did not lock
    -- a missing row, so simultaneous first requests could race on the INSERT.
    INSERT INTO private.rate_limits AS rate_limit
        (key, attempts, window_start, expires_at)
    VALUES
        (p_key, 1, now_ts, now_ts + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE
    SET attempts = CASE
            WHEN rate_limit.expires_at <= now_ts THEN 1
            ELSE rate_limit.attempts + 1
        END,
        window_start = CASE
            WHEN rate_limit.expires_at <= now_ts THEN now_ts
            ELSE rate_limit.window_start
        END,
        expires_at = CASE
            WHEN rate_limit.expires_at <= now_ts THEN now_ts + make_interval(secs => p_window_seconds)
            ELSE rate_limit.expires_at
        END
    RETURNING attempts INTO current_attempts;

    RETURN current_attempts <= p_max_attempts;
END;
$;

-- Rate limits for authenticated RPCs. Clients cannot choose the limits or the
-- action names; this helper derives the bucket from the JWT subject.
CREATE OR REPLACE FUNCTION private.consume_rpc_rate_limit(p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_user_id UUID := auth.uid();
    v_max_attempts INT;
    v_window_seconds INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;

    CASE p_action
        WHEN 'workspace_create' THEN v_max_attempts := 10; v_window_seconds := 3600;
        WHEN 'workspace_invite' THEN v_max_attempts := 20; v_window_seconds := 3600;
        WHEN 'task_create' THEN v_max_attempts := 120; v_window_seconds := 3600;
        WHEN 'task_progress' THEN v_max_attempts := 120; v_window_seconds := 60;
        WHEN 'focus_session_write' THEN v_max_attempts := 300; v_window_seconds := 86400;
        ELSE
            RAISE EXCEPTION 'Invalid rate-limit action.' USING ERRCODE = '22023';
    END CASE;

    RETURN private.check_rate_limit(
        'rpc:' || p_action || ':' || v_user_id::TEXT,
        v_max_attempts,
        v_window_seconds
    );
END;
$;

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

CREATE OR REPLACE FUNCTION private.consume_rpc_rate_limit(p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_user_id UUID := auth.uid();
    v_max_attempts INT;
    v_window_seconds INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;

    CASE p_action
        WHEN 'workspace_create' THEN v_max_attempts := 10; v_window_seconds := 3600;
        WHEN 'workspace_invite' THEN v_max_attempts := 20; v_window_seconds := 3600;
        WHEN 'task_create' THEN v_max_attempts := 120; v_window_seconds := 3600;
        WHEN 'task_progress' THEN v_max_attempts := 120; v_window_seconds := 60;
        WHEN 'focus_session_write' THEN v_max_attempts := 300; v_window_seconds := 86400;
        ELSE
            RAISE EXCEPTION 'Invalid rate-limit action.' USING ERRCODE = '22023';
    END CASE;

    RETURN private.check_rate_limit(
        'rpc:' || p_action || ':' || v_user_id::TEXT,
        v_max_attempts,
        v_window_seconds
    );
END;
$;

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

CREATE OR REPLACE FUNCTION public.create_workspace(
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_creator_id UUID := auth.uid();
    v_clean_name TEXT := trim(p_name);
    v_workspace RECORD;
BEGIN
    IF v_creator_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'Invalid argument: Workspace name is required.' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_clean_name) > 80 OR COALESCE(char_length(p_description), 0) > 500 THEN
        RAISE EXCEPTION 'Workspace name or description exceeds the allowed length.' USING ERRCODE = '22023';
    END IF;
    IF NOT private.consume_rpc_rate_limit('workspace_create') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
    END IF;

    INSERT INTO public.workspaces (
        name,
        description,
        created_by
    )
    VALUES (
        v_clean_name,
        p_description,
        v_creator_id
    )
    RETURNING * INTO v_workspace;

    RETURN jsonb_build_object(
        'success', true,
        'workspace', row_to_json(v_workspace)
    );
END;
$$;

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
    IF char_length(v_clean_title) > 160 OR COALESCE(char_length(p_description), 0) > 2000 THEN
        RAISE EXCEPTION 'Task title or description exceeds the allowed length.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(cardinality(p_recipient_user_ids), 0) > 50 THEN
        RAISE EXCEPTION 'A task cannot have more than 50 recipients.' USING ERRCODE = '22023';
    END IF;
    IF NOT private.consume_rpc_rate_limit('task_create') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
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
        IF NOT private.is_workspace_member(p_workspace_id, v_creator_id) THEN
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
        IF NOT private.is_workspace_member(p_workspace_id, v_creator_id) THEN
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
                IF p_workspace_id IS NOT NULL AND NOT private.is_workspace_member(p_workspace_id, v_target_u_id) THEN
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

CREATE OR REPLACE FUNCTION public.add_workspace_member_by_email(p_workspace_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_target_user_id UUID;
    v_caller_id UUID := auth.uid();
    v_clean_email TEXT := lower(trim(p_email));
    v_generic_result JSONB := jsonb_build_object(
        'success', true,
        'message', 'تمت معالجة الطلب. إذا كان البريد مرتبطًا بحساب موثق وغير عضو بالفعل، فستتم إضافته إلى المساحة.'
    );
BEGIN
    IF NOT private.is_workspace_owner(p_workspace_id, v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only workspace owners can invite members.'
            USING ERRCODE = '42501';
    END IF;
    IF v_clean_email IS NULL OR v_clean_email = '' OR length(v_clean_email) > 254
       OR position('@' IN v_clean_email) < 2 THEN
        RETURN jsonb_build_object('success', false, 'message', 'أدخل عنوان بريد إلكتروني صالحًا.');
    END IF;
    IF NOT private.consume_rpc_rate_limit('workspace_invite') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
    END IF;

    SELECT id INTO v_target_user_id FROM auth.users
    WHERE lower(email) = v_clean_email AND email_confirmed_at IS NOT NULL
    ORDER BY id LIMIT 1;

    -- Deliberately return the same response for unknown, unverified, self,
    -- duplicate and successfully added addresses. Never return the user ID.
    IF v_target_user_id IS NULL OR v_target_user_id = v_caller_id
       OR private.is_workspace_member(p_workspace_id, v_target_user_id) THEN
        RETURN v_generic_result;
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_target_user_id, 'member');

    RETURN v_generic_result;
END;
$;

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

    IF NOT private.can_view_task(p_task_id, v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Task permission denied.' USING ERRCODE = '42501';
    END IF;
    IF NOT private.consume_rpc_rate_limit('task_progress') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
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

    IF NOT private.can_view_task(p_task_id, v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Task permission denied.' USING ERRCODE = '42501';
    END IF;
    IF NOT private.consume_rpc_rate_limit('task_progress') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
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

CREATE OR REPLACE FUNCTION public.record_focus_session(
    p_client_session_id TEXT,
    p_task_id UUID,
    p_workspace_id UUID,
    p_started_at TIMESTAMPTZ,
    p_ended_at TIMESTAMPTZ,
    p_duration_seconds INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_workspace_id UUID := p_workspace_id;
    v_task_workspace_id UUID;
    v_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;
    IF p_client_session_id IS NULL OR trim(p_client_session_id) = '' OR length(p_client_session_id) > 160 THEN
        RAISE EXCEPTION 'Invalid client_session_id.' USING ERRCODE = '22023';
    END IF;
    IF p_started_at IS NULL OR p_ended_at IS NULL OR NOT isfinite(p_started_at) OR NOT isfinite(p_ended_at)
       OR p_ended_at < p_started_at OR p_duration_seconds IS NULL OR p_duration_seconds < 1 OR p_duration_seconds > 86400
       OR p_duration_seconds > ceil(extract(epoch FROM p_ended_at - p_started_at)) + 1 THEN
        RAISE EXCEPTION 'Invalid focus session timestamps or duration.' USING ERRCODE = '22023';
    END IF;
    -- Idempotent retries must not consume another rate-limit slot.
    SELECT id INTO v_id FROM public.focus_sessions
    WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
    IF v_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'id', v_id);
    END IF;
    IF NOT private.consume_rpc_rate_limit('focus_session_write') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
    END IF;
    IF p_task_id IS NOT NULL THEN
        IF NOT private.can_view_task(p_task_id, v_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: Task permission denied.' USING ERRCODE = '42501';
        END IF;
        SELECT workspace_id INTO v_task_workspace_id FROM public.tasks WHERE id = p_task_id;
        IF p_workspace_id IS NOT NULL AND p_workspace_id IS DISTINCT FROM v_task_workspace_id THEN
            RAISE EXCEPTION 'Mismatch: task_id does not belong to specified workspace_id.' USING ERRCODE = '22000';
        END IF;
        v_workspace_id := v_task_workspace_id;
    END IF;
    IF v_workspace_id IS NOT NULL AND NOT private.is_workspace_member(v_workspace_id, v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Workspace permission denied.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.focus_sessions
        (user_id, client_session_id, task_id, workspace_id, started_at, ended_at, duration_seconds)
    VALUES
        (v_user_id, p_client_session_id, p_task_id, v_workspace_id, p_started_at, p_ended_at, p_duration_seconds)
    ON CONFLICT (user_id, client_session_id) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.focus_sessions
        WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
    END IF;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Focus session was not saved.' USING ERRCODE = '40001';
    END IF;
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- The private helper is intentionally callable only by authenticated functions
-- in this non-exposed schema, never as a PostgREST public RPC.
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.consume_rpc_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.consume_rpc_rate_limit(TEXT) TO authenticated;

-- Co-members may see display names, but never need another member's email address.
REVOKE SELECT (email) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, display_name, updated_at) ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
