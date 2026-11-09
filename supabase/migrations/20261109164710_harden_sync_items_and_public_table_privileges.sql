-- Harden browser-facing table privileges and sync_items write boundaries.
-- Safe additive migration: no user rows are deleted or rewritten.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON ALL TABLES IN SCHEMA private
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.consume_rpc_rate_limit(p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_max_attempts INT;
    v_window_seconds INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.'
            USING ERRCODE = '42501';
    END IF;
    CASE p_action
        WHEN 'workspace_create' THEN v_max_attempts := 10; v_window_seconds := 3600;
        WHEN 'workspace_invite' THEN v_max_attempts := 20; v_window_seconds := 3600;
        WHEN 'workspace_invitation_response' THEN v_max_attempts := 60; v_window_seconds := 3600;
        WHEN 'task_create' THEN v_max_attempts := 120; v_window_seconds := 3600;
        WHEN 'task_progress' THEN v_max_attempts := 120; v_window_seconds := 60;
        WHEN 'focus_session_write' THEN v_max_attempts := 300; v_window_seconds := 86400;
        WHEN 'sync_item_write' THEN v_max_attempts := 1000; v_window_seconds := 60;
        WHEN 'sync_item_daily' THEN v_max_attempts := 10000; v_window_seconds := 86400;
        ELSE RAISE EXCEPTION 'Invalid rate-limit action.' USING ERRCODE = '22023';
    END CASE;
    RETURN private.check_rate_limit(
        'rpc:' || p_action || ':' || v_user_id::TEXT,
        v_max_attempts,
        v_window_seconds
    );
END;
$function$;

REVOKE ALL ON FUNCTION private.consume_rpc_rate_limit(TEXT)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_sync_item_write_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT := auth.role();
BEGIN
    IF v_user_id IS NULL THEN
        IF v_role IS DISTINCT FROM 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Authentication required.'
                USING ERRCODE = '42501';
        END IF;
    ELSIF NEW.user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: sync item must belong to the authenticated user.'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.tool IS NULL OR length(NEW.tool) < 1 OR length(NEW.tool) > 64
       OR NEW.tool !~ '^[a-z0-9][a-z0-9_-]*$' THEN
        RAISE EXCEPTION 'Invalid sync tool identifier.' USING ERRCODE = '22023';
    END IF;
    IF NEW.item_id IS NULL OR length(NEW.item_id) < 1 OR length(NEW.item_id) > 200
       OR NEW.item_id ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'Invalid sync item identifier.' USING ERRCODE = '22023';
    END IF;
    IF NEW.data IS NULL OR octet_length(NEW.data::text) > 262144 THEN
        RAISE EXCEPTION 'Sync item payload exceeds the 256 KiB limit.' USING ERRCODE = '22023';
    END IF;

    IF v_role IS DISTINCT FROM 'service_role' THEN
        IF NOT private.consume_rpc_rate_limit('sync_item_write')
           OR NOT private.consume_rpc_rate_limit('sync_item_daily') THEN
            RAISE EXCEPTION 'Sync write rate limit exceeded. Retry later.'
                USING ERRCODE = 'PGRST',
                      DETAIL = '{"status":429,"status_text":"Too Many Requests"}',
                      HINT = 'HTTP 429 Too Many Requests';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_sync_item_write_limits()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_sync_item_write_limits ON public.sync_items;
CREATE TRIGGER trg_enforce_sync_item_write_limits
BEFORE INSERT OR UPDATE ON public.sync_items
FOR EACH ROW
EXECUTE FUNCTION private.enforce_sync_item_write_limits();

COMMIT;
