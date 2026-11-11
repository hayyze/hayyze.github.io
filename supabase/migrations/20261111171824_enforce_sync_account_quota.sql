-- Enforce aggregate per-account sync limits.
-- Counts all active sync items across tools and retained JSONB bytes across both
-- active items and soft-deleted tombstones. No existing records are deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.check_sync_item_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    max_payload_bytes CONSTANT INT := 262144; -- 256 KiB per JSON item
    max_collection_items CONSTANT INT := 500; -- active items per tool/user
    max_account_items CONSTANT INT := 2000; -- active items across all tools
    max_account_payload_bytes CONSTANT BIGINT := 2097152; -- 2 MiB of retained JSONB payloads
    current_count BIGINT := 0;
    current_account_items BIGINT := 0;
    current_account_bytes BIGINT := 0;
    new_payload_bytes BIGINT := 0;
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

    -- Browser roles may write only rows belonging to the authenticated account.
    -- Explicit service-role requests and trusted direct database sessions retain
    -- administrative access for maintenance and migrations.
    IF request_role IS DISTINCT FROM 'service_role'
       AND NOT (request_role IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
        IF auth.uid() IS NULL OR user_id_val IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        data_val := NEW.data;
        new_payload_bytes := octet_length(data_val::text);
        IF data_val IS NULL OR new_payload_bytes > max_payload_bytes THEN
            RAISE EXCEPTION 'Payload size exceeds the limit of 256 KiB for item % in tool %.',
                item_id_val, tool_val
                USING ERRCODE = '22026';
        END IF;

        IF request_role IS DISTINCT FROM 'service_role'
           AND NOT (request_role IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
            -- Serialize all writes for one account before checking aggregate caps.
            -- The account lock also makes concurrent writes to different tools safe.
            PERFORM pg_catalog.pg_advisory_xact_lock(
                pg_catalog.hashtextextended(
                    'hayyiz-sync-account-quota:' || user_id_val::TEXT,
                    0
                )
            );

            IF TG_OP = 'INSERT' THEN
                SELECT EXISTS (
                    SELECT 1
                    FROM public.sync_items
                    WHERE user_id = user_id_val
                      AND tool = tool_val
                      AND item_id = item_id_val
                ) INTO is_existing_item;

                IF NOT is_existing_item THEN
                    SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL),
                           COALESCE(SUM(octet_length(data::text)), 0)
                    INTO current_account_items, current_account_bytes
                    FROM public.sync_items
                    WHERE user_id = user_id_val;

                    IF current_account_items + 1 > max_account_items THEN
                        RAISE EXCEPTION 'Account sync quota exceeded: maximum of % active items across all tools.',
                            max_account_items
                            USING ERRCODE = '54000';
                    END IF;
                    IF current_account_bytes + new_payload_bytes > max_account_payload_bytes THEN
                        RAISE EXCEPTION 'Account sync storage quota exceeded: maximum of 2 MiB of retained JSON payloads.'
                            USING ERRCODE = '54000';
                    END IF;
                END IF;
            ELSE
                SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL),
                       COALESCE(SUM(octet_length(data::text)), 0)
                INTO current_account_items, current_account_bytes
                FROM public.sync_items
                WHERE user_id = user_id_val
                  AND NOT (
                      user_id = OLD.user_id
                      AND tool = OLD.tool
                      AND item_id = OLD.item_id
                  );

                IF NEW.deleted_at IS NULL
                   AND current_account_items + 1 > max_account_items THEN
                    RAISE EXCEPTION 'Account sync quota exceeded: maximum of % active items across all tools.',
                        max_account_items
                        USING ERRCODE = '54000';
                END IF;
                -- Count retained tombstones toward the payload cap until cleanup
                -- physically removes them; soft deletion must not free storage.
                IF current_account_bytes + new_payload_bytes > max_account_payload_bytes THEN
                    RAISE EXCEPTION 'Account sync storage quota exceeded: maximum of 2 MiB of retained JSON payloads.'
                        USING ERRCODE = '54000';
                END IF;
            END IF;

            IF NEW.deleted_at IS NULL THEN
                -- The same account-wide lock is always acquired first. This
                -- collection lock preserves the existing 500-item per-tool cap.
                PERFORM pg_catalog.pg_advisory_xact_lock(
                    pg_catalog.hashtextextended(
                        'hayyiz-sync-collection:' || user_id_val::TEXT || ':' || tool_val,
                        0
                    )
                );

                IF TG_OP = 'INSERT' THEN
                    IF NOT is_existing_item THEN
                        SELECT COUNT(*) INTO current_count
                        FROM public.sync_items
                        WHERE user_id = user_id_val
                          AND tool = tool_val
                          AND deleted_at IS NULL;
                    END IF;
                ELSE
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
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

COMMIT;
