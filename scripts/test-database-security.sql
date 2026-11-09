-- Run as the database owner on a disposable database, or in the same transaction as
-- the proposed migration. Every fixture and schema change must be rolled back.
-- This tests actual PostgreSQL roles, grants, RLS, triggers, and RPCs, not a mock.
BEGIN;
DO $$
DECLARE v_rate_limits_oid OID := to_regclass('private.rate_limits');
BEGIN
    IF v_rate_limits_oid IS NULL THEN
        RAISE EXCEPTION 'private.rate_limits table was not created';
    END IF;
    IF to_regclass('private.workspace_invitations') IS NULL THEN
        RAISE EXCEPTION 'private.workspace_invitations table was not created';
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('private.workspace_invitations')) THEN
        RAISE EXCEPTION 'private.workspace_invitations must have row level security enabled';
    END IF;
    IF has_table_privilege('anon', 'private.workspace_invitations', 'SELECT')
       OR has_table_privilege('authenticated', 'private.workspace_invitations', 'SELECT')
       OR has_table_privilege('authenticated', 'private.workspace_invitations', 'INSERT')
       OR has_table_privilege('authenticated', 'private.workspace_invitations', 'DELETE') THEN
        RAISE EXCEPTION 'API roles must not access private workspace invitation records directly';
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_rate_limits_oid) THEN
        RAISE EXCEPTION 'private.rate_limits must have row level security enabled';
    END IF;
    IF has_table_privilege('anon', 'private.rate_limits', 'SELECT')
       OR has_table_privilege('authenticated', 'private.rate_limits', 'SELECT')
       OR has_table_privilege('anon', 'private.rate_limits', 'INSERT')
       OR has_table_privilege('authenticated', 'private.rate_limits', 'INSERT') THEN
        RAISE EXCEPTION 'API roles must not access internal rate-limit counters';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = v_rate_limits_oid
          AND contype = 'p'
          AND pg_get_constraintdef(oid) = 'PRIMARY KEY (key)'
    ) THEN
        RAISE EXCEPTION 'private.rate_limits.key must be unique for atomic upserts';
    END IF;
END;
$$;




SELECT set_config('hayyiz_test.owner', gen_random_uuid()::text, true);
SELECT set_config('hayyiz_test.member', gen_random_uuid()::text, true);
SELECT set_config('hayyiz_test.other', gen_random_uuid()::text, true);
SELECT set_config('hayyiz_test.unverified', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data)
SELECT current_setting('hayyiz_test.' || fixture.name)::uuid, 'authenticated', 'authenticated',
       current_setting('hayyiz_test.' || fixture.name) || '@example.invalid',
       CASE WHEN fixture.name = 'unverified' THEN NULL ELSE now() END,
       jsonb_build_object('display_name', 'Hayyiz transactional test')
FROM (VALUES ('owner'), ('member'), ('other'), ('unverified')) AS fixture(name);

-- A poisoned legacy profile must neither impersonate a verified email nor hide its owner.
UPDATE public.profiles
SET email = current_setting('hayyiz_test.member') || '@example.invalid'
WHERE id = current_setting('hayyiz_test.other')::uuid;
UPDATE public.profiles SET email = 'stale-' || id::text || '@example.invalid'
WHERE id = current_setting('hayyiz_test.member')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.other'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.other'), 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('hayyiz_test.foreign_workspace', public.create_workspace('transactional foreign workspace', NULL)->'workspace'->>'id', true);
SELECT set_config('hayyiz_test.foreign_task', public.create_synchronized_task(
    'foreign task', NULL, 'workspace', 'independent', current_setting('hayyiz_test.foreign_workspace')::uuid
)->'task'->>'id', true);

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);
SELECT set_config('hayyiz_test.workspace', public.create_workspace('transactional workspace', NULL)->'workspace'->>'id', true);

DO $$
DECLARE
    result jsonb;
    generic_invite_result jsonb;
BEGIN
    IF NOT private.is_workspace_owner(current_setting('hayyiz_test.workspace')::uuid, auth.uid()) THEN
        RAISE EXCEPTION 'create_workspace failed to create the owner membership';
    END IF;
    BEGIN
        DELETE FROM public.workspace_members WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid
            AND user_id = auth.uid();
        RAISE EXCEPTION 'last workspace owner could leave an orphaned workspace';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    result := public.add_workspace_member_by_email(current_setting('hayyiz_test.workspace')::uuid,
        '  ' || upper(current_setting('hayyiz_test.member') || '@example.invalid') || '  ');
    IF result->>'success' <> 'true' OR result ? 'user_id' THEN
        RAISE EXCEPTION 'invite response disclosed target identity or failed to process a verified account';
    END IF;
    generic_invite_result := result;
    IF EXISTS (SELECT 1 FROM public.workspace_members
                WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid
                  AND user_id = current_setting('hayyiz_test.member')::uuid) THEN
        RAISE EXCEPTION 'invitation granted membership before recipient acceptance';
    END IF;
    result := public.add_workspace_member_by_email(current_setting('hayyiz_test.workspace')::uuid,
        current_setting('hayyiz_test.unverified') || '@example.invalid');
    IF result IS DISTINCT FROM generic_invite_result THEN
        RAISE EXCEPTION 'unknown/unverified address response disclosed account existence';
    END IF;
    IF has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT')
       OR has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.profiles', 'email', 'INSERT')
       OR has_column_privilege('anon', 'public.profiles', 'email', 'SELECT') THEN
        RAISE EXCEPTION 'client can read or forge a profile email';
    END IF;
    BEGIN
        UPDATE public.profiles SET email = 'forged@example.invalid' WHERE id = auth.uid();
        RAISE EXCEPTION 'profile email update unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM email FROM public.profiles WHERE id = auth.uid();
        RAISE EXCEPTION 'own profile email was readable by an API role';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM email FROM public.profiles WHERE id = current_setting('hayyiz_test.member')::uuid;
        RAISE EXCEPTION 'co-member profile email was readable by an API role';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('hayyiz_test.other')::uuid) THEN
        RAISE EXCEPTION 'profile RLS disclosed an unrelated account';
    END IF;
    UPDATE public.profiles SET display_name = 'Allowed name change' WHERE id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'display name editing broke'; END IF;
    IF has_function_privilege('authenticated', 'public.can_view_task(uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.record_focus_session(text,uuid,uuid,timestamp with time zone,timestamp with time zone,integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'public membership oracle or anonymous write RPC is executable';
    END IF;
    IF NOT has_function_privilege('authenticated', 'private.can_view_task(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'RLS helper cannot be called by the policy role';
    END IF;
    IF has_function_privilege('authenticated', 'private.consume_rpc_rate_limit(text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'private.check_rate_limit(text,integer,integer)', 'EXECUTE')
       OR has_function_privilege('anon', 'private.check_rate_limit(text,integer,integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'API clients must not be able to call or control internal rate-limit helpers';
    END IF;
    IF has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
       OR has_table_privilege('authenticated', 'public.tasks', 'INSERT')
       OR has_table_privilege('authenticated', 'public.workspace_members', 'INSERT')
       OR has_table_privilege('authenticated', 'public.task_members', 'INSERT')
       OR has_table_privilege('authenticated', 'public.task_progress', 'INSERT')
       OR has_table_privilege('authenticated', 'public.task_progress', 'UPDATE') THEN
        RAISE EXCEPTION 'direct REST inserts/progress updates can bypass validated RPCs';
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.focus_sessions', 'SELECT') THEN
        RAISE EXCEPTION 'authenticated users must be able to read RLS-filtered focus sessions';
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.focus_sessions', 'INSERT') THEN
        RAISE EXCEPTION 'legacy own focus-session inserts must remain compatible';
    END IF;
    BEGIN
        PERFORM public.is_workspace_member(current_setting('hayyiz_test.workspace')::uuid, auth.uid());
        RAISE EXCEPTION 'legacy public membership helper is executable';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

-- The intended recipient alone can list and accept the invitation.
SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.member'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.member'), 'role', 'authenticated')::text, true);
DO $$
DECLARE
    v_invitation RECORD;
    result JSONB;
BEGIN
    SELECT * INTO v_invitation
    FROM public.get_my_workspace_invitations()
    WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation recipient could not see their own pending invitation';
    END IF;
    result := public.respond_to_workspace_invitation(v_invitation.invitation_id, TRUE);
    IF result->>'success' <> 'true' OR result->>'accepted' <> 'true' THEN
        RAISE EXCEPTION 'recipient could not accept their workspace invitation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members
                   WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid
                     AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'acceptance did not create workspace membership';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('hayyiz_test.member')::uuid) THEN
        RAISE EXCEPTION 'co-member display profile visibility broke after accepting an invitation';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);

SELECT set_config('hayyiz_test.directed_task', public.create_synchronized_task(
    'directed task', NULL, 'specific_users', 'independent', current_setting('hayyiz_test.workspace')::uuid,
    NULL, ARRAY[current_setting('hayyiz_test.member')::uuid]
)->'task'->>'id', true);
SELECT set_config('hayyiz_test.independent_task', public.create_synchronized_task(
    'independent task', NULL, 'workspace', 'independent', current_setting('hayyiz_test.workspace')::uuid
)->'task'->>'id', true);
SELECT set_config('hayyiz_test.group_task', public.create_synchronized_task(
    'group task', NULL, 'workspace', 'collaborative', current_setting('hayyiz_test.workspace')::uuid
)->'task'->>'id', true);
SELECT set_config('hayyiz_test.delete_task', public.create_synchronized_task(
    'task deletion preserves focus history', NULL, 'workspace', 'collaborative', current_setting('hayyiz_test.workspace')::uuid
)->'task'->>'id', true);
SELECT set_config('hayyiz_test.personal_task', public.create_synchronized_task('personal task')->'task'->>'id', true);

DO $$
BEGIN
    UPDATE public.tasks SET title = 'Allowed title change' WHERE id = current_setting('hayyiz_test.directed_task')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'creator task editing broke'; END IF;
    BEGIN
        UPDATE public.tasks SET workspace_id = current_setting('hayyiz_test.foreign_workspace')::uuid
        WHERE id = current_setting('hayyiz_test.directed_task')::uuid;
        RAISE EXCEPTION 'task was moved into a foreign workspace';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.tasks SET creator_id = current_setting('hayyiz_test.other')::uuid
        WHERE id = current_setting('hayyiz_test.directed_task')::uuid;
        RAISE EXCEPTION 'task creator was changed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.tasks SET scope = 'workspace' WHERE id = current_setting('hayyiz_test.directed_task')::uuid;
        RAISE EXCEPTION 'task privacy scope was changed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.tasks SET completed = true WHERE id = current_setting('hayyiz_test.group_task')::uuid;
        RAISE EXCEPTION 'client wrote collaborative completion directly';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE public.workspaces SET created_by = current_setting('hayyiz_test.other')::uuid
        WHERE id = current_setting('hayyiz_test.workspace')::uuid;
        RAISE EXCEPTION 'workspace creator was changed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        INSERT INTO public.task_members (task_id, user_id)
        VALUES (current_setting('hayyiz_test.personal_task')::uuid, current_setting('hayyiz_test.member')::uuid);
        RAISE EXCEPTION 'personal task accepted another member';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM public.set_task_progress_and_recalculate(current_setting('hayyiz_test.independent_task')::uuid, true);
    IF (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.independent_task')::uuid) THEN
        RAISE EXCEPTION 'independent progress completed the shared task for everyone';
    END IF;
    PERFORM public.set_task_progress_and_recalculate(current_setting('hayyiz_test.group_task')::uuid, true);
    IF (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.group_task')::uuid) THEN
        RAISE EXCEPTION 'collaborative task completed before all current members';
    END IF;
END;
$$;

-- Idempotent outbox retries preserve the first record, including its original duration.
SELECT set_config('hayyiz_test.focus_id', public.record_focus_session(
    's_transactional_retry', current_setting('hayyiz_test.directed_task')::uuid, NULL,
    now() - interval '10 minutes', now(), 600
)->>'id', true);
DO $$
DECLARE result jsonb;
BEGIN
    result := public.record_focus_session('s_transactional_retry', current_setting('hayyiz_test.directed_task')::uuid,
        NULL, now() - interval '10 minutes', now(), 500);
    IF result->>'success' <> 'true' OR result->>'id' <> current_setting('hayyiz_test.focus_id') THEN
        RAISE EXCEPTION 'focus retry did not return the original session';
    END IF;
    IF (SELECT count(*) FROM public.focus_sessions WHERE user_id = auth.uid() AND client_session_id = 's_transactional_retry') <> 1
       OR NOT EXISTS (SELECT 1 FROM public.focus_sessions WHERE id = current_setting('hayyiz_test.focus_id')::uuid
                      AND duration_seconds = 600 AND workspace_id = current_setting('hayyiz_test.workspace')::uuid) THEN
        RAISE EXCEPTION 'focus retry duplicated/changed history or failed to derive workspace';
    END IF;
    -- Old clients omit client_session_id and may insert a not-yet-ended session.
    INSERT INTO public.focus_sessions (user_id, task_id, duration_seconds)
    VALUES (auth.uid(), current_setting('hayyiz_test.personal_task')::uuid, 0);
    BEGIN
        PERFORM public.record_focus_session('invalid-task', current_setting('hayyiz_test.foreign_task')::uuid,
            NULL, now() - interval '10 minutes', now(), 600);
        RAISE EXCEPTION 'focus RPC accepted an inaccessible task';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.record_focus_session('invalid-workspace', current_setting('hayyiz_test.personal_task')::uuid,
            current_setting('hayyiz_test.workspace')::uuid, now() - interval '10 minutes', now(), 600);
        RAISE EXCEPTION 'focus RPC accepted an unrelated workspace for a personal task';
    EXCEPTION WHEN SQLSTATE '22000' THEN NULL;
    END;
    BEGIN
        PERFORM public.record_focus_session('invalid-dates', NULL, NULL, now(), now() - interval '1 second', 1);
        RAISE EXCEPTION 'focus RPC accepted reversed timestamps';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        PERFORM public.record_focus_session('invalid-duration', NULL, NULL, now() - interval '1 minute', now(), 600);
        RAISE EXCEPTION 'focus RPC accepted duration larger than elapsed time';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        INSERT INTO public.focus_sessions (user_id, duration_seconds)
        VALUES (current_setting('hayyiz_test.member')::uuid, 1);
        RAISE EXCEPTION 'focus insert accepted another user identity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

-- A late network write must not replace newer data or revive a newer tombstone.
INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at, deleted_at)
VALUES (auth.uid(), 'transactional-test', current_setting('hayyiz_test.owner'), '{"version":2}',
        '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');
INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at, deleted_at)
VALUES (auth.uid(), 'transactional-test', current_setting('hayyiz_test.owner'), '{"version":1}',
        '2026-01-01T00:00:00Z', NULL)
ON CONFLICT (user_id, tool, item_id) DO UPDATE
SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sync_items
                   WHERE user_id = auth.uid() AND tool = 'transactional-test' AND item_id = current_setting('hayyiz_test.owner')
                     AND data->>'version' = '2' AND deleted_at IS NOT NULL AND updated_at = '2026-01-02T00:00:00Z') THEN
        RAISE EXCEPTION 'stale upsert overwrote newer data or its tombstone';
    END IF;
    UPDATE public.sync_items SET data = '{"version":3}', updated_at = '2026-01-03T00:00:00Z', deleted_at = NULL
    WHERE user_id = auth.uid() AND tool = 'transactional-test' AND item_id = current_setting('hayyiz_test.owner');
    IF NOT EXISTS (SELECT 1 FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'transactional-test'
                   AND item_id = current_setting('hayyiz_test.owner') AND data->>'version' = '3' AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'newer sync update was discarded';
    END IF;
    BEGIN
        INSERT INTO public.sync_items (user_id, tool, item_id, data)
        VALUES (current_setting('hayyiz_test.member')::uuid, 'transactional-test', current_setting('hayyiz_test.owner'), '{}');
        RAISE EXCEPTION 'sync insert accepted another user identity';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

-- CRDT laws and legacy residual migration are checked with the private helper as owner.
RESET ROLE;
DO $$
DECLARE
    a JSONB := '{"2026-10-23":35,"__hayyiz_focus_v2":{"baseline":{"2026-10-23":{"minutes":25,"sessions":1}},"devices":{"A":{"2026-10-23":{"minutes":10,"sessions":1}}},"totalBaseline":1}}';
    b JSONB := '{"2026-10-23":45,"__hayyiz_focus_v2":{"baseline":{"2026-10-23":{"minutes":25,"sessions":1}},"devices":{"B":{"2026-10-23":{"minutes":20,"sessions":1}}},"totalBaseline":2}}';
    result JSONB; malformed JSONB;
BEGIN
    result := private.merge_focus_history(private.merge_focus_history('{"2026-10-23":25}', a), b);
    IF result->>'2026-10-23' <> '55'
       OR result->'__hayyiz_focus_v2'->'baseline'->'2026-10-23'->>'minutes' <> '25'
       OR result->'__hayyiz_focus_v2'->>'totalBaseline' <> '2' THEN
        RAISE EXCEPTION 'focus CRDT did not preserve legacy25 + deviceA10 + deviceB20 = 55';
    END IF;
    IF private.merge_focus_history(a, b) IS DISTINCT FROM private.merge_focus_history(b, a)
       OR private.merge_focus_history(result, result) IS DISTINCT FROM result
       OR private.merge_focus_history(private.merge_focus_history(a, b), '{"2026-10-23":25}') IS DISTINCT FROM result THEN
        RAISE EXCEPTION 'focus CRDT merge is not commutative/idempotent for the supported state';
    END IF;
    result := private.merge_focus_history(jsonb_set(a, '{2026-10-23}', '40'), b);
    IF result->>'2026-10-23' <> '60' THEN
        RAISE EXCEPTION 'flat legacy residual was counted incorrectly beside v2 metadata';
    END IF;
    malformed := private.merge_focus_history('{}',
        '{"2026-02-30":99,"2026-10-22":12,"2026-10-23":{"invalid":true},"__hayyiz_focus_v2":{"baseline":[],"devices":{"__proto__":{"2026-10-23":{"minutes":500,"sessions":50}},"invalid/name":{},"good_device":{"2026-10-23":{"minutes":5,"sessions":1},"2026-10-21":{"minutes":-1,"sessions":1.5}}},"totalBaseline":{}}}');
    IF malformed ? '2026-02-30' OR malformed->>'2026-10-22' <> '12' OR malformed->>'2026-10-23' <> '5'
       OR malformed->'__hayyiz_focus_v2'->'devices' ? '__proto__'
       OR malformed->'__hayyiz_focus_v2'->'devices' ? 'invalid/name'
       OR malformed->'__hayyiz_focus_v2'->>'totalBaseline' <> '0' THEN
        RAISE EXCEPTION 'malformed focus metadata was not safely normalized';
    END IF;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
    a JSONB := '{"2026-10-23":35,"__hayyiz_focus_v2":{"baseline":{"2026-10-23":{"minutes":25,"sessions":1}},"devices":{"A":{"2026-10-23":{"minutes":10,"sessions":1}}},"totalBaseline":1}}';
    b JSONB := '{"2026-10-23":45,"__hayyiz_focus_v2":{"baseline":{"2026-10-23":{"minutes":25,"sessions":1}},"devices":{"B":{"2026-10-23":{"minutes":20,"sessions":1}}},"totalBaseline":2}}';
    result JSONB; reverse_result JSONB;
BEGIN
    INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at)
    VALUES (auth.uid(), 'focus-history', 'history', '{"2026-10-23":25}', '2026-01-01T00:00:00Z');
    INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at)
    VALUES (auth.uid(), 'focus-history', 'history', a, '2026-01-03T00:00:00Z')
    ON CONFLICT (user_id, tool, item_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
    -- B's old timestamp must not discard its independent contribution.
    INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at)
    VALUES (auth.uid(), 'focus-history', 'history', b, '2026-01-02T00:00:00Z')
    ON CONFLICT (user_id, tool, item_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
    SELECT data INTO result FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    IF result->>'2026-10-23' <> '55' OR NOT EXISTS (
        SELECT 1 FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history'
        AND updated_at = '2026-01-03T00:00:00Z') THEN
        RAISE EXCEPTION 'late focus upsert discarded a device or moved its timestamp backwards';
    END IF;
    UPDATE public.sync_items SET data = a, updated_at = '2026-01-01T00:00:00Z'
    WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    SELECT data INTO reverse_result FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    IF reverse_result IS DISTINCT FROM result THEN RAISE EXCEPTION 'focus device retry duplicated or lost counters'; END IF;
    DELETE FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    INSERT INTO public.sync_items (user_id, tool, item_id, data, updated_at)
    VALUES (auth.uid(), 'focus-history', 'history', '{"2026-10-23":25}', '2026-01-01T00:00:00Z');
    UPDATE public.sync_items SET data = b, updated_at = '2026-01-02T00:00:00Z'
    WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    UPDATE public.sync_items SET data = a, updated_at = '2026-01-03T00:00:00Z'
    WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    SELECT data INTO reverse_result FROM public.sync_items WHERE user_id = auth.uid() AND tool = 'focus-history' AND item_id = 'history';
    IF reverse_result IS DISTINCT FROM result THEN RAISE EXCEPTION 'focus A/B upload order changed the merged state'; END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.member'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.member'), 'role', 'authenticated')::text, true);
SELECT set_config('hayyiz_test.member_focus', public.record_focus_session(
    's_transactional_delete', current_setting('hayyiz_test.delete_task')::uuid, NULL,
    now() - interval '1 minute', now(), 60
)->>'id', true);
SELECT set_config('hayyiz_test.member_workspace_focus', public.record_focus_session(
    's_transactional_workspace_delete', NULL, current_setting('hayyiz_test.workspace')::uuid,
    now() - interval '1 minute', now(), 60
)->>'id', true);
SELECT set_config('hayyiz_test.member_created_task', public.create_synchronized_task(
    'member-created directed task', NULL, 'specific_users', 'independent', current_setting('hayyiz_test.workspace')::uuid,
    NULL, ARRAY[current_setting('hayyiz_test.owner')::uuid]
)->'task'->>'id', true);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = current_setting('hayyiz_test.directed_task')::uuid) THEN
        RAISE EXCEPTION 'assigned member cannot read the task';
    END IF;
    IF EXISTS (SELECT 1 FROM public.task_progress WHERE task_id = current_setting('hayyiz_test.independent_task')::uuid
               AND user_id = auth.uid()) THEN RAISE EXCEPTION 'another user progress was copied to member'; END IF;
    IF EXISTS (SELECT 1 FROM public.sync_items WHERE user_id = current_setting('hayyiz_test.owner')::uuid) THEN
        RAISE EXCEPTION 'sync RLS leaked another user rows';
    END IF;
    BEGIN
        PERFORM public.add_workspace_member_by_email(current_setting('hayyiz_test.workspace')::uuid,
            current_setting('hayyiz_test.other') || '@example.invalid');
        RAISE EXCEPTION 'non-owner invited a member';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM public.set_task_progress_and_recalculate(current_setting('hayyiz_test.directed_task')::uuid, true);
    PERFORM public.set_task_progress_and_recalculate(current_setting('hayyiz_test.group_task')::uuid, true);
    IF NOT (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.group_task')::uuid) THEN
        RAISE EXCEPTION 'group task did not complete after both members completed';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);
DO $$
BEGIN
    DELETE FROM public.tasks WHERE id = current_setting('hayyiz_test.delete_task')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'deleting a task with another member focus history failed'; END IF;
    IF EXISTS (SELECT 1 FROM public.focus_sessions WHERE id = current_setting('hayyiz_test.member_focus')::uuid) THEN
        RAISE EXCEPTION 'deleted task focus history became shared outside its removed task';
    END IF;
    PERFORM public.add_workspace_member_by_email(current_setting('hayyiz_test.workspace')::uuid,
        current_setting('hayyiz_test.other') || '@example.invalid');
    IF NOT (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.group_task')::uuid) THEN
        RAISE EXCEPTION 'pending invitation changed task completion before acceptance';
    END IF;
END;
$$;

-- Adding a workspace member now requires explicit acceptance by that account.
SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.other'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.other'), 'role', 'authenticated')::text, true);
DO $$
DECLARE
    v_invitation RECORD;
    result JSONB;
BEGIN
    SELECT * INTO v_invitation
    FROM public.get_my_workspace_invitations()
    WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'second recipient could not see pending invitation'; END IF;
    result := public.respond_to_workspace_invitation(v_invitation.invitation_id, TRUE);
    IF result->>'accepted' <> 'true' THEN RAISE EXCEPTION 'second recipient could not accept invite'; END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);
DO $$
BEGIN
    IF (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.group_task')::uuid) THEN
        RAISE EXCEPTION 'accepting a new required member did not recalculate collaborative completion';
    END IF;
    DELETE FROM public.workspace_members WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid
        AND user_id = current_setting('hayyiz_test.other')::uuid;
    IF NOT (SELECT completed FROM public.tasks WHERE id = current_setting('hayyiz_test.group_task')::uuid) THEN
        RAISE EXCEPTION 'removing an incomplete member did not recalculate collaborative completion';
    END IF;
    DELETE FROM public.workspace_members WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid
        AND user_id = current_setting('hayyiz_test.member')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'owner membership removal broke'; END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.member'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.member'), 'role', 'authenticated')::text, true);
DO $$
DECLARE affected integer;
BEGIN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE workspace_id = current_setting('hayyiz_test.workspace')::uuid)
       OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = current_setting('hayyiz_test.workspace')::uuid)
       OR EXISTS (SELECT 1 FROM public.task_members WHERE task_id = current_setting('hayyiz_test.directed_task')::uuid)
       OR EXISTS (SELECT 1 FROM public.task_progress WHERE task_id = current_setting('hayyiz_test.directed_task')::uuid) THEN
        RAISE EXCEPTION 'removed member/creator still has workspace task or progress access';
    END IF;
    UPDATE public.tasks SET title = 'forbidden after removal'
    WHERE id = current_setting('hayyiz_test.member_created_task')::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'removed creator still edits task'; END IF;
    BEGIN
        PERFORM public.set_task_progress_and_recalculate(current_setting('hayyiz_test.member_created_task')::uuid, true);
        RAISE EXCEPTION 'removed creator still writes task progress';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.record_focus_session('removed-member-focus', current_setting('hayyiz_test.directed_task')::uuid,
            NULL, now() - interval '1 minute', now(), 60);
        RAISE EXCEPTION 'removed member still records a task focus session';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.other'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.other'), 'role', 'authenticated')::text, true);
DO $$
DECLARE result jsonb;
BEGIN
    IF EXISTS (SELECT 1 FROM public.focus_sessions WHERE id = current_setting('hayyiz_test.focus_id')::uuid) THEN
        RAISE EXCEPTION 'private task focus history leaked to a non-viewer';
    END IF;
    result := public.record_focus_session('s_transactional_retry', NULL, NULL, now() - interval '1 minute', now(), 60);
    IF result->>'id' = current_setting('hayyiz_test.focus_id') THEN
        RAISE EXCEPTION 'focus idempotency key is not scoped to its user';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);
SELECT public.add_workspace_member_by_email(current_setting('hayyiz_test.workspace')::uuid,
    current_setting('hayyiz_test.member') || '@example.invalid');
SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.member'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.member'), 'role', 'authenticated')::text, true);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = current_setting('hayyiz_test.directed_task')::uuid) THEN
        RAISE EXCEPTION 'workspace rejoin silently restored a removed directed assignment';
    END IF;
END;
$$;

RESET ROLE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.task_members WHERE task_id = current_setting('hayyiz_test.directed_task')::uuid
               AND user_id = current_setting('hayyiz_test.member')::uuid) THEN
        RAISE EXCEPTION 'workspace member removal did not clean directed assignments';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.task_progress WHERE task_id = current_setting('hayyiz_test.directed_task')::uuid
                   AND user_id = current_setting('hayyiz_test.member')::uuid AND completed) THEN
        RAISE EXCEPTION 'revocation deleted historical progress';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.focus_sessions WHERE id = current_setting('hayyiz_test.member_focus')::uuid
                   AND task_id IS NULL AND workspace_id IS NULL AND duration_seconds = 60) THEN
        RAISE EXCEPTION 'task deletion destroyed another member focus history';
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sync_items') <> 4 THEN
        RAISE EXCEPTION 'sync policies were not consolidated into four own-row operations';
    END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('hayyiz_test.owner'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('hayyiz_test.owner'), 'role', 'authenticated')::text, true);
DELETE FROM public.workspaces WHERE id = current_setting('hayyiz_test.workspace')::uuid;
RESET ROLE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = current_setting('hayyiz_test.workspace')::uuid)
       OR NOT EXISTS (SELECT 1 FROM public.focus_sessions WHERE id = current_setting('hayyiz_test.member_workspace_focus')::uuid
                       AND task_id IS NULL AND workspace_id IS NULL AND duration_seconds = 60) THEN
        RAISE EXCEPTION 'deleting workspace failed or destroyed another member focus history';
    END IF;
END;
$$;

SELECT 'database security regression checks passed; all fixtures rolled back' AS result;
ROLLBACK;
