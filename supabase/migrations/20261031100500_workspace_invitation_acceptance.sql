-- Require explicit recipient consent before workspace membership is created.
-- Invitation records remain in the private schema and are only exposed through scoped RPCs.

CREATE TABLE IF NOT EXISTS private.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    CONSTRAINT workspace_invitations_expiry CHECK (expires_at > created_at),
    CONSTRAINT workspace_invitations_unique_target UNIQUE (workspace_id, invited_user_id)
);
ALTER TABLE private.workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_recipient_expiry
    ON private.workspace_invitations (invited_user_id, expires_at DESC);
REVOKE ALL ON TABLE private.workspace_invitations FROM PUBLIC, anon, authenticated;

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
        WHEN 'workspace_invitation_response' THEN v_max_attempts := 60; v_window_seconds := 3600;
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
$$;
REVOKE ALL ON FUNCTION private.consume_rpc_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;


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
        'message', 'تمت معالجة طلب الدعوة. إذا كان البريد مرتبطًا بحساب موثق، فستظهر الدعوة لصاحب الحساب ليقبلها.'
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

    -- Same response for unknown, unverified, self, current-member, and valid targets.
    -- The invitation remains private and the recipient must explicitly accept it.
    IF v_target_user_id IS NULL OR v_target_user_id = v_caller_id
       OR private.is_workspace_member(p_workspace_id, v_target_user_id) THEN
        RETURN v_generic_result;
    END IF;

    INSERT INTO private.workspace_invitations
        (workspace_id, invited_user_id, invited_by, created_at, expires_at)
    VALUES
        (p_workspace_id, v_target_user_id, v_caller_id, NOW(), NOW() + INTERVAL '30 days')
    ON CONFLICT (workspace_id, invited_user_id) DO UPDATE
       SET invited_by = EXCLUDED.invited_by,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at;

    RETURN v_generic_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_workspace_invitations()
RETURNS TABLE (
    invitation_id UUID,
    workspace_id UUID,
    workspace_name TEXT,
    workspace_description TEXT,
    inviter_name TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        wi.id,
        wi.workspace_id,
        w.name,
        w.description,
        COALESCE(p.display_name, 'عضو'),
        wi.created_at,
        wi.expires_at
    FROM private.workspace_invitations wi
    JOIN public.workspaces w ON w.id = wi.workspace_id
    LEFT JOIN public.profiles p ON p.id = wi.invited_by
    WHERE wi.invited_user_id = (SELECT auth.uid())
      AND wi.expires_at > statement_timestamp()
    ORDER BY wi.created_at DESC
    LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_workspace_invitation(
    p_invitation_id UUID,
    p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_invitation RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.' USING ERRCODE = '42501';
    END IF;
    IF p_invitation_id IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'Invalid invitation response.' USING ERRCODE = '22023';
    END IF;
    IF NOT private.consume_rpc_rate_limit('workspace_invitation_response') THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please retry later.'
            USING ERRCODE = 'PGRST',
                  DETAIL = '{"status": 429, "status_text": "Too Many Requests"}',
                  HINT = 'HTTP 429 Too Many Requests';
    END IF;

    SELECT wi.id, wi.workspace_id, wi.expires_at
      INTO v_invitation
      FROM private.workspace_invitations wi
     WHERE wi.id = p_invitation_id
       AND wi.invited_user_id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الدعوة غير متاحة أو انتهت صلاحيتها.');
    END IF;

    IF v_invitation.expires_at <= NOW() THEN
        DELETE FROM private.workspace_invitations WHERE id = v_invitation.id;
        RETURN jsonb_build_object('success', false, 'message', 'انتهت صلاحية الدعوة.');
    END IF;

    IF p_accept THEN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (v_invitation.workspace_id, v_user_id, 'member')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END IF;

    DELETE FROM private.workspace_invitations WHERE id = v_invitation.id;

    RETURN jsonb_build_object(
        'success', true,
        'accepted', p_accept,
        'message', CASE WHEN p_accept THEN 'تم قبول الدعوة والانضمام إلى المساحة.' ELSE 'تم رفض الدعوة.' END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_workspace_invitations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_to_workspace_invitation(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_workspace_invitation(UUID, BOOLEAN) TO authenticated;


NOTIFY pgrst, 'reload schema';
