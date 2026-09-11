CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_on_workspace_created ON public.workspaces;
CREATE TRIGGER trg_on_workspace_created AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

CREATE OR REPLACE FUNCTION public.handle_new_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.task_members (task_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'creator')
  ON CONFLICT (task_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_on_task_created ON public.tasks;
CREATE TRIGGER trg_on_task_created AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_new_task();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='workspace_members_user_profile_fkey' AND conrelid='public.workspace_members'::regclass) THEN
    ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='task_members_user_profile_fkey' AND conrelid='public.task_members'::regclass) THEN
    ALTER TABLE public.task_members ADD CONSTRAINT task_members_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

INSERT INTO public.workspace_members (workspace_id,user_id,role)
SELECT w.id,w.created_by,'owner' FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id=w.id AND wm.user_id=w.created_by)
ON CONFLICT (workspace_id,user_id) DO NOTHING;

INSERT INTO public.task_members (task_id,user_id,role)
SELECT t.id,t.creator_id,'creator' FROM public.tasks t
WHERE NOT EXISTS (SELECT 1 FROM public.task_members tm WHERE tm.task_id=t.id AND tm.user_id=t.creator_id)
ON CONFLICT (task_id,user_id) DO NOTHING;

-- Restore profile visibility/update rules required by workspace membership features.
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view co-members profiles" ON public.profiles;
CREATE POLICY "Users can view co-members profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm1
    JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid() AND wm2.user_id = public.profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.task_members tm1
    JOIN public.task_members tm2 ON tm1.task_id = tm2.task_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = public.profiles.id
  )
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS trg_recalculate_on_task_member_delete ON public.task_members;
DROP TRIGGER IF EXISTS trg_recalculate_on_workspace_member_delete ON public.workspace_members;
CREATE OR REPLACE FUNCTION public.handle_member_removal_recalculate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r_task RECORD;
BEGIN
  IF TG_TABLE_NAME = 'task_members' THEN
    PERFORM public.recalculate_collaborative_task(OLD.task_id);
  ELSIF TG_TABLE_NAME = 'workspace_members' THEN
    FOR r_task IN
      SELECT id FROM public.tasks
      WHERE workspace_id = OLD.workspace_id AND completion_mode = 'collaborative'
    LOOP
      PERFORM public.recalculate_collaborative_task(r_task.id);
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_recalculate_on_task_member_delete
AFTER DELETE ON public.task_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal_recalculate();
CREATE TRIGGER trg_recalculate_on_workspace_member_delete
AFTER DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal_recalculate();

DROP TRIGGER IF EXISTS trg_validate_task_member ON public.task_members;
CREATE OR REPLACE FUNCTION public.validate_task_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT creator_id, workspace_id, scope INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found.' USING ERRCODE = '22000';
  END IF;
  IF v_task.workspace_id IS NOT NULL
     AND NOT public.is_workspace_member(v_task.workspace_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Invalid task member.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_task_member
BEFORE INSERT OR UPDATE ON public.task_members
FOR EACH ROW EXECUTE FUNCTION public.validate_task_member_insert();

DROP TRIGGER IF EXISTS trg_validate_focus_session ON public.focus_sessions;
CREATE OR REPLACE FUNCTION public.validate_focus_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task_ws_id UUID;
BEGIN
  IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user identity.' USING ERRCODE = '42501';
  END IF;
  IF NEW.duration_seconds < 0 OR NEW.duration_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid duration_seconds.' USING ERRCODE = '22023';
  END IF;
  IF NEW.task_id IS NOT NULL THEN
    IF NOT public.can_view_task(NEW.task_id, NEW.user_id) THEN
      RAISE EXCEPTION 'Unauthorized: User does not have access to specified task.' USING ERRCODE = '42501';
    END IF;
    SELECT workspace_id INTO v_task_ws_id FROM public.tasks WHERE id = NEW.task_id;
    IF NEW.workspace_id IS NOT NULL AND v_task_ws_id IS NOT NULL AND NEW.workspace_id <> v_task_ws_id THEN
      RAISE EXCEPTION 'Mismatch: task_id does not belong to specified workspace_id.' USING ERRCODE = '22000';
    END IF;
  END IF;
  IF NEW.workspace_id IS NOT NULL
     AND NOT public.is_workspace_member(NEW.workspace_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Unauthorized: User is not a member of specified workspace.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_focus_session
BEFORE INSERT OR UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_focus_session();

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

DROP POLICY IF EXISTS "Users can view permitted tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authorized users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators or workspace owners can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators or workspace owners can delete tasks" ON public.tasks;
CREATE POLICY "Users can view permitted tasks" ON public.tasks FOR SELECT TO authenticated
USING (public.can_view_task(id, auth.uid()));
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid() AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())));
CREATE POLICY "Creators or workspace owners can update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (creator_id = auth.uid() OR (workspace_id IS NOT NULL AND public.is_workspace_owner(workspace_id, auth.uid())));
CREATE POLICY "Creators or workspace owners can delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (creator_id = auth.uid() OR (workspace_id IS NOT NULL AND public.is_workspace_owner(workspace_id, auth.uid())));

DROP POLICY IF EXISTS "Task viewers can read task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can manage task members" ON public.task_members;
DROP POLICY IF EXISTS "Task creators can remove task members" ON public.task_members;
CREATE POLICY "Task viewers can read task members" ON public.task_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_task(task_id, auth.uid()));
CREATE POLICY "Task creators can manage task members" ON public.task_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid()));
CREATE POLICY "Task creators can remove task members" ON public.task_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND creator_id = auth.uid()));

DROP POLICY IF EXISTS "Task viewers can read task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can update own task progress" ON public.task_progress;
DROP POLICY IF EXISTS "Users can insert own task progress" ON public.task_progress;
CREATE POLICY "Task viewers can read task progress" ON public.task_progress FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_task(task_id, auth.uid()));
CREATE POLICY "Users can insert own task progress" ON public.task_progress FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_task(task_id, auth.uid()));
CREATE POLICY "Users can update own task progress" ON public.task_progress FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.can_view_task(task_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view permitted focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can insert own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can update own focus sessions" ON public.focus_sessions;
CREATE POLICY "Users can view permitted focus sessions" ON public.focus_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.task_members tm WHERE tm.task_id = t.id AND tm.user_id = auth.uid()) OR (t.scope = 'workspace' AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = t.workspace_id AND wm.user_id = auth.uid()))))) OR (workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = public.focus_sessions.workspace_id AND wm.user_id = auth.uid())));
CREATE POLICY "Users can insert own focus sessions" ON public.focus_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own focus sessions" ON public.focus_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Restore least-privilege execution grants for helper functions and the public RPCs that exist in this schema.
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_task_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_collaborative_task(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_member_removal_recalculate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_task() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_task_member_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_focus_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_progress_and_recalculate(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_synchronized_task(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, UUID[]) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_progress; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END;
$$;

NOTIFY pgrst,'reload schema';
