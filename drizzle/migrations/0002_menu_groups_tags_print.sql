ALTER TABLE public.items ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bar_settings ADD COLUMN IF NOT EXISTS menu_print jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS items_bar_cat_group_idx ON public.items(bar_id, category_id, group_name);