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
