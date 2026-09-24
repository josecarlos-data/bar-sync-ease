CREATE TABLE public.order_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  original_text text NOT NULL,
  instruction_text text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_instructions_order_idx ON public.order_instructions(order_id);
GRANT SELECT, INSERT ON public.order_instructions TO authenticated;
GRANT ALL ON public.order_instructions TO service_role;
ALTER TABLE public.order_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_instructions_select ON public.order_instructions FOR SELECT TO authenticated USING (public.is_staff_of(bar_id));
CREATE POLICY order_instructions_insert ON public.order_instructions FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin',bar_id) OR public.has_role(auth.uid(),'waiter',bar_id)) AND created_by = auth.uid());
ALTER TABLE public.order_instructions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_instructions;