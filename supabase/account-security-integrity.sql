-- Hayyiz: authenticated workspace boundaries, private RLS helpers, and durable focus writes.
-- Targeted additive migration; retains all tables, rows, keys, and existing RPC signatures.
-- Preflight scripts/test-database-security.sql in a transaction before applying.
-- private must remain outside the PostgREST exposed schemas.
CREATE SCHEMA IF NOT EXISTS private;

-- Atomic account-scoped rate limits shared by write RPCs.
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
    now_ts TIMESTAMPTZ := NOW();
    current_attempts INT;
BEGIN
    IF p_key IS NULL OR length(p_key) > 200
       OR p_max_attempts < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
        RETURN FALSE;
    END IF;

    DELETE FROM private.rate_limits WHERE expires_at < now_ts;
    INSERT INTO private.rate_limits AS rate_limit
        (key, attempts, window_start, expires_at)
    VALUES
        (p_key, 1, now_ts, now_ts + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE
    SET attempts = CASE WHEN rate_limit.expires_at <= now_ts THEN 1 ELSE rate_limit.attempts + 1 END,
        window_start = CASE WHEN rate_limit.expires_at <= now_ts THEN now_ts ELSE rate_limit.window_start END,
        expires_at = CASE WHEN rate_limit.expires_at <= now_ts
            THEN now_ts + make_interval(secs => p_window_seconds) ELSE rate_limit.expires_at END
    RETURNING attempts INTO current_attempts;

    RETURN current_attempts <= p_max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION private.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.consume_rpc_rate_limit(p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
        ELSE RAISE EXCEPTION 'Invalid rate-limit action.' USING ERRCODE = '22023';
    END CASE;

    RETURN private.check_rate_limit('rpc:' || p_action || ':' || v_user_id::TEXT,
                                    v_max_attempts, v_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION private.consume_rpc_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS client_session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_user_client_session
ON public.focus_sessions (user_id, client_session_id);


CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_task_members_user ON public.task_members(user_id);

CREATE INDEX IF NOT EXISTS idx_task_progress_user ON public.task_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.tasks(creator_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_creator ON public.workspaces(created_by);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON public.focus_sessions(task_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_task ON public.focus_sessions(user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_workspace ON public.focus_sessions(workspace_id);

CREATE OR REPLACE FUNCTION private.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id
    );
$$;


CREATE OR REPLACE FUNCTION private.is_workspace_owner(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'owner'
    );
$$;


CREATE OR REPLACE FUNCTION private.is_task_member(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.task_members
        WHERE task_id = p_task_id AND user_id = p_user_id
    );
$$;


CREATE OR REPLACE FUNCTION private.can_view_task(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task RECORD;
BEGIN
    IF p_user_id IS NULL THEN RETURN FALSE; END IF;
    SELECT creator_id, workspace_id, scope INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    -- Workspace membership is a prerequisite, including for an old creator or assignee.
    IF v_task.workspace_id IS NOT NULL AND NOT private.is_workspace_member(v_task.workspace_id, p_user_id) THEN
        RETURN FALSE;
    END IF;
    IF v_task.creator_id = p_user_id THEN RETURN TRUE; END IF;
    IF v_task.scope = 'workspace' THEN RETURN TRUE; END IF;
    RETURN v_task.scope = 'specific_users' AND private.is_task_member(p_task_id, p_user_id);
END;
$$;


CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT private.is_workspace_member(p_workspace_id, p_user_id);
$$;


CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT private.is_workspace_owner(p_workspace_id, p_user_id);
$$;


CREATE OR REPLACE FUNCTION public.is_task_member(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT private.is_task_member(p_task_id, p_user_id);
$$;


CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT private.can_view_task(p_task_id, p_user_id);
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
        FROM public.task_members tm WHERE tm.task_id = p_task_id
          AND (v_task.workspace_id IS NULL OR private.is_workspace_member(v_task.workspace_id, tm.user_id));
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
        WHERE tp.task_id = p_task_id AND tp.completed = TRUE
          AND (v_task.workspace_id IS NULL OR private.is_workspace_member(v_task.workspace_id, tp.user_id));
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


-- Member Removal Recalculation Trigger Function
CREATE OR REPLACE FUNCTION private.guard_workspace_owner_removal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.role = 'owner' THEN
        -- Serialize owner departures. A cascading workspace deletion has no parent row left.
        PERFORM 1 FROM public.workspaces WHERE id = OLD.workspace_id FOR UPDATE;
        IF FOUND AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id AND user_id <> OLD.user_id AND role = 'owner'
        ) THEN
            RAISE EXCEPTION 'Cannot remove the last workspace owner; transfer ownership or delete the workspace.'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_workspace_owner_removal() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_workspace_owner_removal ON public.workspace_members;
CREATE TRIGGER trg_guard_workspace_owner_removal BEFORE DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION private.guard_workspace_owner_removal();

CREATE OR REPLACE FUNCTION public.handle_member_removal_recalculate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r_task RECORD; v_workspace_id UUID; v_task_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'task_members' THEN
        v_task_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END;
        PERFORM public.recalculate_collaborative_task(v_task_id);
    ELSIF TG_TABLE_NAME = 'workspace_members' THEN
        v_workspace_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.workspace_id ELSE NEW.workspace_id END;
        IF TG_OP = 'DELETE' THEN
            -- A former assignee must be explicitly assigned again after rejoining.
            DELETE FROM public.task_members tm USING public.tasks t
            WHERE tm.task_id = t.id AND t.workspace_id = OLD.workspace_id AND tm.user_id = OLD.user_id;
        END IF;
        FOR r_task IN SELECT id FROM public.tasks WHERE workspace_id = v_workspace_id AND completion_mode = 'collaborative' LOOP
            PERFORM public.recalculate_collaborative_task(r_task.id);
        END LOOP;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
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

-- A new member changes the required group size just as removing a member does.
DROP TRIGGER IF EXISTS trg_recalculate_on_task_member_insert ON public.task_members;
CREATE TRIGGER trg_recalculate_on_task_member_insert
AFTER INSERT ON public.task_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal_recalculate();
DROP TRIGGER IF EXISTS trg_recalculate_on_workspace_member_insert ON public.workspace_members;
CREATE TRIGGER trg_recalculate_on_workspace_member_insert
AFTER INSERT ON public.workspace_members
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

    IF v_task.scope = 'me' AND NEW.user_id <> v_task.creator_id THEN
        RAISE EXCEPTION 'Personal tasks cannot have additional members.' USING ERRCODE = '42501';
    END IF;

    IF v_task.workspace_id IS NOT NULL AND NOT private.is_workspace_member(v_task.workspace_id, NEW.user_id) THEN
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
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task_ws_id UUID;
BEGIN
    -- FK SET NULL actions preserve another member's history when a task/workspace is deleted.
    -- Only the internal referential action may clear a vanished reference; all other fields stay fixed.
    IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
       AND ROW(NEW.id, NEW.user_id, NEW.client_session_id, NEW.started_at, NEW.ended_at, NEW.duration_seconds, NEW.created_at)
           IS NOT DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.client_session_id, OLD.started_at, OLD.ended_at, OLD.duration_seconds, OLD.created_at)
       AND (NEW.task_id IS NOT DISTINCT FROM OLD.task_id OR
            (NEW.task_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = OLD.task_id)))
       AND (NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id OR
            (NEW.workspace_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id))) THEN
        -- A removed task must not turn its private session into a workspace-wide session.
        IF NEW.task_id IS NULL AND OLD.task_id IS NOT NULL THEN
            NEW.workspace_id := NULL;
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.' USING ERRCODE = '42501';
    END IF;
    -- Legacy clients may still insert own focus rows directly. Enforce the same
    -- server-side per-account limit at the table boundary, not just in the RPC.
    IF TG_OP = 'INSERT' AND NOT private.consume_rpc_rate_limit('focus_session_write') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
    END IF;
    IF NEW.duration_seconds < 0 OR NEW.duration_seconds > 86400 THEN
        RAISE EXCEPTION 'Invalid duration_seconds.' USING ERRCODE = '22023';
    END IF;
    IF NEW.task_id IS NOT NULL THEN
        IF NOT private.can_view_task(NEW.task_id, NEW.user_id) THEN
            RAISE EXCEPTION 'Unauthorized: User does not have access to specified task.' USING ERRCODE = '42501';
        END IF;
        SELECT workspace_id INTO v_task_ws_id FROM public.tasks WHERE id = NEW.task_id;
        IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM v_task_ws_id THEN
            RAISE EXCEPTION 'Mismatch: task_id does not belong to specified workspace_id.' USING ERRCODE = '22000';
        END IF;
        NEW.workspace_id := v_task_ws_id;
    END IF;
    IF NEW.workspace_id IS NOT NULL AND NOT private.is_workspace_member(NEW.workspace_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Unauthorized: User is not a member of specified workspace.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_focus_session ON public.focus_sessions;
CREATE TRIGGER trg_validate_focus_session
BEFORE INSERT OR UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_focus_session();




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
AS $$
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

    -- The API response is identical for unknown, unverified, self, duplicate and
    -- successfully added addresses. Never disclose the matching user ID.
    IF v_target_user_id IS NULL OR v_target_user_id = v_caller_id
       OR private.is_workspace_member(p_workspace_id, v_target_user_id) THEN
        RETURN v_generic_result;
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_target_user_id, 'member');

    RETURN v_generic_result;
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
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    SELECT id INTO v_id FROM public.focus_sessions
    WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
    IF v_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'id', v_id);
    END IF;
    -- The BEFORE INSERT trigger applies the shared rate limit, including legacy direct writes.
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


-- 8.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view co-members profiles" ON public.profiles;

CREATE POLICY "Users can view co-members profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = (select auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.workspace_members wm1
        JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
        WHERE wm1.user_id = (select auth.uid()) AND wm2.user_id = public.profiles.id
    ) OR
    EXISTS (
        SELECT 1 FROM public.task_members tm1
        JOIN public.task_members tm2 ON tm1.task_id = tm2.task_id
        WHERE tm1.user_id = (select auth.uid()) AND tm2.user_id = public.profiles.id
    )
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- 8.2 WORKSPACE POLICIES
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspace" ON public.workspaces;

CREATE POLICY "Members can view workspace"
ON public.workspaces FOR SELECT TO authenticated
USING (
    private.is_workspace_member(id, (select auth.uid()))
);

CREATE POLICY "Users can create workspace"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update workspace"
ON public.workspaces FOR UPDATE TO authenticated
USING (private.is_workspace_owner(id, (select auth.uid())))
WITH CHECK (private.is_workspace_owner(id, (select auth.uid())));

CREATE POLICY "Owners can delete workspace"
ON public.workspaces FOR DELETE TO authenticated
USING (private.is_workspace_owner(id, (select auth.uid())));

-- 8.3 WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "Members can view member list" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners or self can remove member" ON public.workspace_members;

CREATE POLICY "Members can view member list"
ON public.workspace_members FOR SELECT TO authenticated
USING (
    user_id = (select auth.uid()) OR private.is_workspace_member(workspace_id, (select auth.uid()))
);

CREATE POLICY "Owners can add members"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (private.is_workspace_owner(workspace_id, (select auth.uid())));

CREATE POLICY "Owners or self can remove member"
ON public.workspace_members FOR DELETE TO authenticated
USING (
    user_id = (select auth.uid()) OR private.is_workspace_owner(workspace_id, (select auth.uid()))
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
    private.can_view_task(id, (select auth.uid()))
);

CREATE POLICY "Users can create tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
    creator_id = auth.uid() AND
    (workspace_id IS NULL OR private.is_workspace_member(workspace_id, (select auth.uid())))
);

CREATE POLICY "Creators or workspace owners can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
    (workspace_id IS NULL OR private.is_workspace_member(workspace_id, (select auth.uid()))) AND
    (creator_id = (select auth.uid()) OR private.is_workspace_owner(workspace_id, (select auth.uid())))
)
WITH CHECK (
    (workspace_id IS NULL OR private.is_workspace_member(workspace_id, (select auth.uid()))) AND
    (creator_id = (select auth.uid()) OR private.is_workspace_owner(workspace_id, (select auth.uid())))
);

CREATE POLICY "Creators or workspace owners can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
    (workspace_id IS NULL OR private.is_workspace_member(workspace_id, (select auth.uid()))) AND
    (creator_id = (select auth.uid()) OR private.is_workspace_owner(workspace_id, (select auth.uid())))
);

-- 8.5 TASK MEMBERS POLICIES
DROP POLICY IF EXISTS "Task viewers can read task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can manage task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can remove task members" ON public.task_members;

CREATE POLICY "Task viewers can read task members"
ON public.task_members FOR SELECT TO authenticated
USING (
    private.can_view_task(task_id, (select auth.uid()))
);

CREATE POLICY "Task creators can manage task members"
ON public.task_members FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid())
);

CREATE POLICY "Task creators can remove task members"
ON public.task_members FOR DELETE TO authenticated
USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid())
);

-- 8.6 TASK PROGRESS POLICIES
DROP POLICY IF EXISTS "Task viewers can read task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can update own task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can insert own task progress" ON public.task_progress;

CREATE POLICY "Task viewers can read task progress"
ON public.task_progress FOR SELECT TO authenticated
USING (
    private.can_view_task(task_id, (select auth.uid()))
);

CREATE POLICY "Users can insert own task progress"
ON public.task_progress FOR INSERT TO authenticated
WITH CHECK (
    user_id = (select auth.uid()) AND private.can_view_task(task_id, (select auth.uid()))
);

CREATE POLICY "Users can update own task progress"
ON public.task_progress FOR UPDATE TO authenticated
USING (
    user_id = (select auth.uid()) AND private.can_view_task(task_id, (select auth.uid()))
)
WITH CHECK (
    user_id = (select auth.uid()) AND private.can_view_task(task_id, (select auth.uid()))
);

-- 8.7 FOCUS SESSIONS POLICIES
DROP POLICY IF EXISTS "Users can view permitted focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can insert own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can update own focus sessions" ON public.focus_sessions;

CREATE POLICY "Users can view permitted focus sessions"
ON public.focus_sessions FOR SELECT TO authenticated
USING (
    user_id = (select auth.uid()) OR
    (task_id IS NOT NULL AND private.can_view_task(task_id, (select auth.uid()))) OR
    (task_id IS NULL AND workspace_id IS NOT NULL AND private.is_workspace_member(workspace_id, (select auth.uid())))
);

CREATE POLICY "Users can insert own focus sessions"
ON public.focus_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own focus sessions"
ON public.focus_sessions FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));




-- Consolidate the historical own-row policies, preserving the same authorization boundary.
DROP POLICY IF EXISTS "Users can read their own sync data" ON public.sync_items;
DROP POLICY IF EXISTS "select_own_items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can read only their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can read their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert their own sync data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert only their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update their own sync data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update only their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete their own sync data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete only their own data" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.sync_items;

ALTER TABLE public.sync_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can insert own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can update own sync items" ON public.sync_items;
DROP POLICY IF EXISTS "Users can delete own sync items" ON public.sync_items;

CREATE POLICY "Users can read own sync items"
ON public.sync_items FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own sync items"
ON public.sync_items FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own sync items"
ON public.sync_items FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own sync items"
ON public.sync_items FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);



-- Pure JSON helpers mirror focus-history.js. Invalid counters normalize to zero.
CREATE OR REPLACE FUNCTION private.focus_counter(p_value JSONB)
RETURNS BIGINT LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_number NUMERIC;
BEGIN
    IF jsonb_typeof(p_value) NOT IN ('number', 'string') THEN RETURN 0; END IF;
    BEGIN
        v_number := (p_value #>> '{}')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN 0;
    END;
    IF v_number >= 0 AND v_number <= 9007199254740991 AND trunc(v_number) = v_number THEN
        RETURN v_number::BIGINT;
    END IF;
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION private.focus_date_key(p_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_date DATE;
BEGIN
    IF p_key IS NULL OR p_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN FALSE; END IF;
    BEGIN
        v_date := p_key::DATE;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN FALSE;
    END;
    RETURN to_char(v_date, 'YYYY-MM-DD') = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION private.focus_days(p_map JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_result JSONB := '{}'; v_entry RECORD;
BEGIN
    IF jsonb_typeof(p_map) IS DISTINCT FROM 'object' THEN RETURN v_result; END IF;
    FOR v_entry IN SELECT key, value FROM jsonb_each(p_map) LOOP
        IF private.focus_date_key(v_entry.key) THEN
            v_result := v_result || jsonb_build_object(v_entry.key, jsonb_build_object(
                'minutes', private.focus_counter(v_entry.value->'minutes'),
                'sessions', private.focus_counter(v_entry.value->'sessions')));
        END IF;
    END LOOP;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.focus_max_days(p_left JSONB, p_right JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT coalesce(jsonb_object_agg(coalesce(a.key, b.key), jsonb_build_object(
        'minutes', greatest(private.focus_counter(a.value->'minutes'), private.focus_counter(b.value->'minutes')),
        'sessions', greatest(private.focus_counter(a.value->'sessions'), private.focus_counter(b.value->'sessions'))
    )), '{}'::jsonb)
    FROM jsonb_each(private.focus_days(p_left)) a
    FULL JOIN jsonb_each(private.focus_days(p_right)) b USING (key);
$$;

CREATE OR REPLACE FUNCTION private.focus_totals(p_baseline JSONB, p_devices JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_result JSONB := private.focus_days(p_baseline); v_device RECORD; v_day RECORD; v_current JSONB;
BEGIN
    IF jsonb_typeof(p_devices) = 'object' THEN
        FOR v_device IN SELECT key, value FROM jsonb_each(p_devices) LOOP
            FOR v_day IN SELECT key, value FROM jsonb_each(private.focus_days(v_device.value)) LOOP
                v_current := coalesce(v_result->v_day.key, '{"minutes":0,"sessions":0}'::jsonb);
                -- NUMERIC avoids integer overflow even for malformed large contributions.
                v_result := v_result || jsonb_build_object(v_day.key, jsonb_build_object(
                    'minutes', (v_current->>'minutes')::NUMERIC + private.focus_counter(v_day.value->'minutes'),
                    'sessions', (v_current->>'sessions')::NUMERIC + private.focus_counter(v_day.value->'sessions')));
            END LOOP;
        END LOOP;
    END IF;
    -- Match the client's safe-integer normalization of the final totals.
    RETURN private.focus_days(v_result);
END;
$$;

CREATE OR REPLACE FUNCTION private.normalize_focus_history(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_payload JSONB := CASE WHEN jsonb_typeof(p_payload) = 'object' THEN p_payload ELSE '{}'::jsonb END;
    v_meta JSONB; v_baseline JSONB; v_devices JSONB := '{}'; v_totals JSONB;
    v_entry RECORD; v_row JSONB; v_missing BIGINT;
BEGIN
    v_meta := v_payload->'__hayyiz_focus_v2';
    IF jsonb_typeof(v_meta) IS DISTINCT FROM 'object' THEN v_meta := '{}'; END IF;
    v_baseline := private.focus_days(v_meta->'baseline');
    IF jsonb_typeof(v_meta->'devices') = 'object' THEN
        FOR v_entry IN SELECT key, value FROM jsonb_each(v_meta->'devices') LOOP
            IF v_entry.key ~ '^[A-Za-z0-9_-]{1,128}$' AND v_entry.key NOT IN ('__proto__', 'constructor', 'prototype') THEN
                v_devices := v_devices || jsonb_build_object(v_entry.key, private.focus_days(v_entry.value));
            END IF;
        END LOOP;
    END IF;
    v_totals := private.focus_totals(v_baseline, v_devices);
    FOR v_entry IN SELECT key, value FROM jsonb_each(v_payload) LOOP
        IF private.focus_date_key(v_entry.key) THEN
            v_missing := greatest(0, private.focus_counter(v_entry.value) - private.focus_counter(v_totals->v_entry.key->'minutes'));
            IF v_missing > 0 THEN
                v_row := coalesce(v_baseline->v_entry.key, '{"minutes":0,"sessions":0}'::jsonb);
                v_baseline := v_baseline || jsonb_build_object(v_entry.key, jsonb_build_object(
                    'minutes', private.focus_counter(to_jsonb(private.focus_counter(v_row->'minutes') + v_missing)),
                    'sessions', private.focus_counter(v_row->'sessions')));
            END IF;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('baseline', v_baseline, 'devices', v_devices,
        'totalBaseline', private.focus_counter(v_meta->'totalBaseline'));
END;
$$;

CREATE OR REPLACE FUNCTION private.merge_focus_history(p_left JSONB, p_right JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_left JSONB := private.normalize_focus_history(p_left);
    v_right JSONB := private.normalize_focus_history(p_right);
    v_baseline JSONB; v_devices JSONB := '{}'; v_totals JSONB;
    v_device RECORD; v_day RECORD; v_result JSONB := '{}';
BEGIN
    v_baseline := private.focus_max_days(v_left->'baseline', v_right->'baseline');
    FOR v_device IN
        SELECT key FROM jsonb_object_keys(v_left->'devices') AS keys(key)
        UNION SELECT key FROM jsonb_object_keys(v_right->'devices') AS keys(key)
    LOOP
        v_devices := v_devices || jsonb_build_object(v_device.key,
            private.focus_max_days(v_left->'devices'->v_device.key, v_right->'devices'->v_device.key));
    END LOOP;
    v_totals := private.focus_totals(v_baseline, v_devices);
    FOR v_day IN SELECT key, value FROM jsonb_each(v_totals) LOOP
        v_result := v_result || jsonb_build_object(v_day.key, v_day.value->'minutes');
    END LOOP;
    RETURN v_result || jsonb_build_object('__hayyiz_focus_v2', jsonb_build_object(
        'baseline', v_baseline, 'devices', v_devices,
        'totalBaseline', greatest(private.focus_counter(v_left->'totalBaseline'), private.focus_counter(v_right->'totalBaseline'))));
END;
$$;

-- The trigger owner can execute these pure helpers; API clients cannot invoke them.
REVOKE ALL ON FUNCTION private.focus_counter(JSONB), private.focus_date_key(TEXT), private.focus_days(JSONB),
    private.focus_max_days(JSONB, JSONB), private.focus_totals(JSONB, JSONB),
    private.normalize_focus_history(JSONB), private.merge_focus_history(JSONB, JSONB)
    FROM PUBLIC, anon, authenticated;



CREATE OR REPLACE FUNCTION private.preserve_newer_sync_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.tool = 'focus-history' AND NEW.item_id = 'history'
       AND OLD.tool = NEW.tool AND OLD.item_id = NEW.item_id THEN
        -- UPDATE/UPSERT holds the row lock, so concurrent devices merge into the latest committed row.
        NEW.data := private.merge_focus_history(OLD.data, NEW.data);
        IF octet_length(NEW.data::text) > 102400 THEN
            RAISE EXCEPTION 'Merged focus history exceeds the 100KB item limit.' USING ERRCODE = '22026';
        END IF;
        IF NEW.updated_at < OLD.updated_at THEN NEW.deleted_at := OLD.deleted_at; END IF;
        NEW.updated_at := greatest(NEW.updated_at, OLD.updated_at);
        RETURN NEW;
    END IF;
    IF NEW.updated_at < OLD.updated_at THEN RETURN NULL; END IF;
    RETURN NEW;
END;
$$;


REVOKE ALL ON FUNCTION private.preserve_newer_sync_item() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_preserve_newer_sync_item ON public.sync_items;
CREATE TRIGGER trg_preserve_newer_sync_item BEFORE UPDATE ON public.sync_items
FOR EACH ROW EXECUTE FUNCTION private.preserve_newer_sync_item();

-- Exposed table grants and immutable sharing identities.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_items TO authenticated;
-- All privileged inserts and progress/focus writes must pass through the validated,
-- rate-limited SECURITY DEFINER RPCs. Direct REST writes would bypass those limits.
REVOKE INSERT ON public.workspaces, public.tasks, public.workspace_members, public.task_members
    FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON public.task_progress
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.workspaces, public.tasks, public.workspace_members, public.task_members TO authenticated;
GRANT SELECT ON public.task_progress TO authenticated;
GRANT INSERT, UPDATE ON public.focus_sessions TO authenticated;
REVOKE UPDATE ON public.workspaces, public.tasks FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, created_by, created_at) ON public.workspaces FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, creator_id, workspace_id, scope, completion_mode, completed, completed_at, created_at)
    ON public.tasks FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, description, updated_at) ON public.workspaces TO authenticated;
GRANT UPDATE (title, description, due_date, updated_at) ON public.tasks TO authenticated;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT (email), UPDATE (email), REFERENCES (email)
    ON public.profiles FROM PUBLIC, anon, authenticated;
-- Only non-sensitive profile fields are visible to co-members. Email remains private.
REVOKE SELECT (email) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, display_name, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles, public.workspaces, public.workspace_members, public.tasks,
    public.task_members, public.task_progress, public.focus_sessions, public.sync_items TO service_role;

-- These policy helpers are intentionally private, outside the exposed public API schema.
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.is_workspace_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.is_workspace_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_workspace_owner(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.is_task_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_task_member(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.can_view_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_task(UUID, UUID) TO authenticated;

-- Revoke execution rights on internal helper functions from PUBLIC, anon, AND authenticated
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_task_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_collaborative_task(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_member_removal_recalculate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_task_member_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_focus_session() FROM PUBLIC, anon, authenticated;

-- Revoke and grant execution rights for user-callable public RPC endpoints
REVOKE ALL ON FUNCTION public.record_focus_session(TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_focus_session(TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[]) TO authenticated;




-- PostgREST invokes a configured pre-request hook after switching to its request role.
-- Do not install/change a hook on an existing deployment; keep an existing hook callable.
DO $$
BEGIN
    IF to_regprocedure('private.pre_request()') IS NOT NULL THEN
        GRANT USAGE ON SCHEMA private TO authenticator, anon, authenticated;
        GRANT EXECUTE ON FUNCTION private.pre_request() TO authenticator, anon, authenticated;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
