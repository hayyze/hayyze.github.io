-- Reconcile the live Supabase workspace feature with the repository schema.
-- Safe to run repeatedly.

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workspace_members_user_profile_fkey'
          AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members
            ADD CONSTRAINT workspace_members_user_profile_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'task_members_user_profile_fkey'
          AND conrelid = 'public.task_members'::regclass
    ) THEN
        ALTER TABLE public.task_members
            ADD CONSTRAINT task_members_user_profile_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END;
$$;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.created_by, 'owner'
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id AND wm.user_id = w.created_by
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.task_members (task_id, user_id, role)
SELECT t.id, t.creator_id, 'creator'
FROM public.tasks t
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_members tm
    WHERE tm.task_id = t.id AND tm.user_id = t.creator_id
)
ON CONFLICT (task_id, user_id) DO NOTHING;

DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace" ON public.workspaces FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_workspace_member(id, auth.uid()));
CREATE POLICY "Users can create workspace" ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update workspace" ON public.workspaces FOR UPDATE TO authenticated
USING (public.is_workspace_owner(id, auth.uid()));
CREATE POLICY "Owners can delete workspace" ON public.workspaces FOR DELETE TO authenticated
USING (public.is_workspace_owner(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view member list" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners or self can remove member" ON public.workspace_members;
CREATE POLICY "Members can view member list" ON public.workspace_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Owners can add members" ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));
CREATE POLICY "Owners or self can remove member" ON public.workspace_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid()));

DO $$
DECLARE t_name TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH t_name IN ARRAY ARRAY['workspaces','workspace_members','tasks','task_members','task_progress','focus_sessions'] LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = t_name
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t_name);
            END IF;
        END LOOP;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- End of workspace runtime reconciliation.
