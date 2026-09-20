
CREATE TABLE public.bill_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('equal','groups')),
  people integer NOT NULL DEFAULT 1 CHECK (people >= 1),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','requested','settled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bill_splits_one_per_session ON public.bill_splits(session_id);

CREATE TABLE public.bill_split_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  split_id uuid NOT NULL REFERENCES public.bill_splits(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','with_waiter')),
  payment_ref text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bill_split_parts_split_idx ON public.bill_split_parts(split_id);

CREATE TABLE public.bill_split_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.bill_split_parts(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  qty numeric(10,2) NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bill_split_assignments_unique ON public.bill_split_assignments(part_id, order_item_id);
CREATE INDEX bill_split_assignments_part_idx ON public.bill_split_assignments(part_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_splits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_split_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_split_assignments TO authenticated;
GRANT ALL ON public.bill_splits TO service_role;
GRANT ALL ON public.bill_split_parts TO service_role;
GRANT ALL ON public.bill_split_assignments TO service_role;

ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_split_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_split_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY splits_access ON public.bill_splits FOR ALL TO authenticated
  USING (public.is_staff_of(bar_id) OR public.is_session_member(session_id))
  WITH CHECK (public.is_staff_of(bar_id) OR public.is_session_member(session_id));

CREATE POLICY split_parts_access ON public.bill_split_parts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bill_splits s WHERE s.id = split_id
    AND (public.is_staff_of(s.bar_id) OR public.is_session_member(s.session_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bill_splits s WHERE s.id = split_id
    AND (public.is_staff_of(s.bar_id) OR public.is_session_member(s.session_id))));

CREATE POLICY split_assignments_access ON public.bill_split_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bill_split_parts p JOIN public.bill_splits s ON s.id = p.split_id
    WHERE p.id = part_id AND (public.is_staff_of(s.bar_id) OR public.is_session_member(s.session_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bill_split_parts p JOIN public.bill_splits s ON s.id = p.split_id
    WHERE p.id = part_id AND (public.is_staff_of(s.bar_id) OR public.is_session_member(s.session_id))));

ALTER TABLE public.bill_splits REPLICA IDENTITY FULL;
ALTER TABLE public.bill_split_parts REPLICA IDENTITY FULL;
ALTER TABLE public.bill_split_assignments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_split_parts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_split_assignments;
