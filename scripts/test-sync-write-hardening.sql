-- Verify the sync item write boundary after the hardening migration.
-- Uses a transaction and a synthetic JWT subject; fixtures are rolled back.
BEGIN;

-- The canonical schema adds a foreign key from sync_items.user_id to auth.users.
-- Create a rollback-only fixture so these tests exercise the same constraint as production.
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data)
VALUES (
    '00000000-0000-4000-8000-000000000042',
    'authenticated',
    'authenticated',
    'sync-hardening-test@example.invalid',
    now(),
    '{"display_name":"Sync hardening test"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000042', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000042","role":"authenticated"}', true);

DO $hayyiz_sync_hardening$
DECLARE
    v_uid uuid := auth.uid();
    v_payload jsonb := to_jsonb(repeat('x', 262145));
BEGIN
    IF v_uid IS DISTINCT FROM '00000000-0000-4000-8000-000000000042'::uuid THEN
        RAISE EXCEPTION 'Synthetic JWT identity was not recognized.';
    END IF;

    IF to_regprocedure('private.enforce_sync_item_write_limits()') IS NULL THEN
        RAISE EXCEPTION 'Sync write guard function is missing.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_enforce_sync_item_write_limits'
          AND tgrelid = 'public.sync_items'::regclass
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'Sync write guard trigger is missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_check_sync_item_limits'
          AND tgrelid = 'public.sync_items'::regclass
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'Per-tool collection quota trigger is missing.';
    END IF;

    IF has_table_privilege('anon', 'public.sync_items', 'TRUNCATE')
       OR has_table_privilege('authenticated', 'public.sync_items', 'TRUNCATE')
       OR has_table_privilege('anon', 'public.tasks', 'TRUNCATE')
       OR has_table_privilege('authenticated', 'public.tasks', 'TRUNCATE') THEN
        RAISE EXCEPTION 'Browser roles retain TRUNCATE privileges.';
    END IF;

    IF has_table_privilege('anon', 'private.rate_limits', 'SELECT')
       OR has_table_privilege('authenticated', 'private.rate_limits', 'SELECT')
       OR has_table_privilege('authenticated', 'private.workspace_invitations', 'SELECT') THEN
        RAISE EXCEPTION 'Private operational tables are directly readable.';
    END IF;

    IF has_function_privilege('authenticated', 'private.enforce_sync_item_write_limits()', 'EXECUTE')
       OR has_function_privilege('anon', 'private.enforce_sync_item_write_limits()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'private.consume_rpc_rate_limit(text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Internal sync helper functions are directly executable by API roles.';
    END IF;

    IF has_function_privilege('authenticated', 'public.check_sync_item_limits()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.check_sync_item_limits()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Sync quota trigger function is directly executable by API roles.';
    END IF;

    BEGIN
        INSERT INTO public.sync_items (user_id, tool, item_id, data)
        VALUES (v_uid, 'transactional-test', 'oversized-payload', v_payload);
        RAISE EXCEPTION 'sync_items accepted an item larger than 256 KiB.';
    EXCEPTION
        WHEN SQLSTATE '22023' OR SQLSTATE '22026' THEN
            NULL;
    END;

    -- Fill one collection, verify an existing-item upsert remains valid, then
    -- reject a 501st active item. Soft deletion frees a slot; resurrection does not
    -- bypass the same quota.
    INSERT INTO public.sync_items (user_id, tool, item_id, data)
    SELECT v_uid, 'quota-test', 'item-' || n::text, '{}'::jsonb
    FROM generate_series(1, 500) AS n;

    INSERT INTO public.sync_items (user_id, tool, item_id, data)
    VALUES (v_uid, 'quota-test', 'item-1', '{"updated":true}'::jsonb)
    ON CONFLICT (user_id, tool, item_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now();

    BEGIN
        INSERT INTO public.sync_items (user_id, tool, item_id, data)
        VALUES (v_uid, 'quota-test', 'item-501', '{}'::jsonb);
        RAISE EXCEPTION 'sync_items accepted more than 500 active items in one tool.';
    EXCEPTION
        WHEN SQLSTATE '54000' THEN
            NULL;
    END;

    UPDATE public.sync_items
    SET deleted_at = now()
    WHERE user_id = v_uid AND tool = 'quota-test' AND item_id = 'item-1';

    INSERT INTO public.sync_items (user_id, tool, item_id, data)
    VALUES (v_uid, 'quota-test', 'item-501', '{}'::jsonb);

    BEGIN
        UPDATE public.sync_items
        SET deleted_at = NULL
        WHERE user_id = v_uid AND tool = 'quota-test' AND item_id = 'item-1';
        RAISE EXCEPTION 'sync_items allowed a tombstone to exceed the active collection quota.';
    EXCEPTION
        WHEN SQLSTATE '54000' THEN
            NULL;
    END;
END;
$hayyiz_sync_hardening$;

ROLLBACK;
