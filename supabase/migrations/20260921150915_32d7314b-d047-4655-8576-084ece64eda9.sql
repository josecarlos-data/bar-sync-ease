ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_per_bar
  ON public.profiles (bar_id, lower(username))
  WHERE username IS NOT NULL;

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (bar_id IS NOT NULL AND public.is_admin_of(bar_id))
  WITH CHECK (bar_id IS NOT NULL AND public.is_admin_of(bar_id));