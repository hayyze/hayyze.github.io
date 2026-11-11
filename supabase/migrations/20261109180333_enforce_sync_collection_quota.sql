-- Restore the intended per-tool sync collection ceiling in production.
-- The canonical schema already defines this invariant, but this deployed project
-- was missing its trigger. The advisory transaction lock makes the count safe
-- under concurrent device writes. Existing rows are not changed or deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.check_sync_item_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    max_payload_bytes CONSTANT INT := 262144; -- 256 KiB per JSON item
    max_collection_items CONSTANT INT := 500;  -- active items per tool/user
    current_count BIGINT := 0;
    is_existing_item BOOLEAN := FALSE;
    user_id_val UUID;
    tool_val TEXT;
    item_id_val TEXT;
    data_val JSONB;
    request_role TEXT := auth.role();
BEGIN
    IF TG_OP = 'DELETE' THEN
        user_id_val := OLD.user_id;
        tool_val := OLD.tool;
        item_id_val := OLD.item_id;
    ELSE
        user_id_val := NEW.user_id;
        tool_val := NEW.tool;
        item_id_val := NEW.item_id;
    END IF;

    -- Browser roles must write only their own rows. Explicit service-role
    -- requests and trusted direct database sessions retain administrative access.
    IF request_role IS DISTINCT FROM 'service_role'
       AND NOT (request_role IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
        IF auth.uid() IS NULL OR user_id_val IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        data_val := NEW.data;
        IF data_val IS NULL OR octet_length(data_val::text) > max_payload_bytes THEN
            RAISE EXCEPTION 'Payload size exceeds the limit of 256 KiB for item % in tool %.',
                item_id_val, tool_val
                USING ERRCODE = '22026';
        END IF;

        IF NEW.deleted_at IS NULL
           AND request_role IS DISTINCT FROM 'service_role'
           AND NOT (request_role IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
            -- Serialize quota checks by account + tool so two concurrent inserts
            -- cannot both observe the same final free slot.
            PERFORM pg_catalog.pg_advisory_xact_lock(
                pg_catalog.hashtextextended(
                    'hayyiz-sync-collection:' || user_id_val::TEXT || ':' || tool_val,
                    0
                )
            );

            IF TG_OP = 'INSERT' THEN
                -- An upsert of an existing item does not consume a new slot.
                SELECT EXISTS (
                    SELECT 1
                    FROM public.sync_items
                    WHERE user_id = user_id_val
                      AND tool = tool_val
                      AND item_id = item_id_val
                ) INTO is_existing_item;

                IF NOT is_existing_item THEN
                    SELECT COUNT(*) INTO current_count
                    FROM public.sync_items
                    WHERE user_id = user_id_val
                      AND tool = tool_val
                      AND deleted_at IS NULL;
                END IF;
            ELSE
                -- Exclude the row being updated; this also blocks resurrection
                -- of a tombstone when the collection is already full.
                SELECT COUNT(*) INTO current_count
                FROM public.sync_items AS existing
                WHERE existing.user_id = user_id_val
                  AND existing.tool = tool_val
                  AND existing.deleted_at IS NULL
                  AND NOT (
                      existing.user_id = OLD.user_id
                      AND existing.tool = OLD.tool
                      AND existing.item_id = OLD.item_id
                  );
            END IF;

            IF current_count >= max_collection_items THEN
                RAISE EXCEPTION 'Quota exceeded: Maximum allowed active items (%) reached for tool %.',
                    max_collection_items, tool_val
                    USING ERRCODE = '54000';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_sync_item_limits()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_sync_item_limits ON public.sync_items;
CREATE TRIGGER trg_check_sync_item_limits
BEFORE INSERT OR UPDATE OR DELETE ON public.sync_items
FOR EACH ROW
EXECUTE FUNCTION public.check_sync_item_limits();

COMMIT;
