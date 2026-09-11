CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, display_name, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data ->> 'display_name',
    u.raw_user_meta_data ->> 'name',
    split_part(COALESCE(u.email, ''), '@', 1)
  ),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
