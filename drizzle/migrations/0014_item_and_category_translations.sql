-- Traducciones de artículos y categorías para la carta del cliente.
CREATE TABLE public.item_translations (
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  lang text NOT NULL,
  name text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, lang)
);

CREATE TABLE public.category_translations (
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  lang text NOT NULL,
  name text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, lang)
);

GRANT SELECT ON public.item_translations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_translations TO authenticated;
GRANT ALL ON public.item_translations TO service_role;
GRANT SELECT ON public.category_translations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_translations TO authenticated;
GRANT ALL ON public.category_translations TO service_role;

ALTER TABLE public.item_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traducciones visibles para la carta" ON public.item_translations
  FOR SELECT TO anon, authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY "traducciones visibles para la carta" ON public.category_translations
  FOR SELECT TO anon, authenticated USING (public.can_view_bar(bar_id));

CREATE POLICY "personal gestiona traducciones" ON public.item_translations
  FOR ALL TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));
CREATE POLICY "personal gestiona traducciones" ON public.category_translations
  FOR ALL TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));