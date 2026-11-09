-- Verify the sync item write boundary after the hardening migration.
-- Uses a transaction and a synthetic JWT subject; fixtures are rolled back.
BEGIN;

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

    BEGIN
        INSERT INTO public.sync_items (user_id, tool, item_id, data)
        VALUES (v_uid, 'transactional-test', 'oversized-payload', v_payload);
        RAISE EXCEPTION 'sync_items accepted an item larger than 256 KiB.';
    EXCEPTION WHEN invalid_parameter_value THEN
        NULL;
    END;
END;
$hayyiz_sync_hardening$;

ROLLBACK;
