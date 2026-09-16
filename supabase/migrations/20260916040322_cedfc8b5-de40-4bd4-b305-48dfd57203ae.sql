
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','waiter','bar','kitchen');
CREATE TYPE public.item_destination AS ENUM ('bar','kitchen');
CREATE TYPE public.session_status AS ENUM ('pending','open','closed');
CREATE TYPE public.line_status AS ENUM ('pending','ready','served');
CREATE TYPE public.call_type AS ENUM ('waiter','bill');
CREATE TYPE public.call_status AS ENUM ('open','done');
CREATE TYPE public.queue_sort AS ENUM ('arrival','table','product');
CREATE TYPE public.allergen AS ENUM ('gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','frutos_cascara','apio','mostaza','sesamo','sulfitos','altramuces','moluscos');

-- BARS
CREATE TABLE public.bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bar_settings (
  bar_id uuid PRIMARY KEY REFERENCES public.bars(id) ON DELETE CASCADE,
  show_prices boolean NOT NULL DEFAULT true,
  split_bar_kitchen boolean NOT NULL DEFAULT true,
  waiter_can_order boolean NOT NULL DEFAULT true,
  free_tapa_with_drink boolean NOT NULL DEFAULT false,
  payments_enabled boolean NOT NULL DEFAULT false,
  queue_sort public.queue_sort NOT NULL DEFAULT 'arrival',
  require_session_approval boolean NOT NULL DEFAULT true,
  auto_close_hours integer NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  bar_id uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bar_id, user_id, role)
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 10,
  image_url text,
  allergens public.allergen[] NOT NULL DEFAULT '{}',
  available boolean NOT NULL DEFAULT true,
  destination public.item_destination NOT NULL DEFAULT 'kitchen',
  is_drink boolean NOT NULL DEFAULT false,
  is_tapa boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  number integer NOT NULL,
  name text,
  qr_token text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bar_id, number)
);

CREATE TABLE public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  nickname text,
  status public.session_status NOT NULL DEFAULT 'pending',
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid
);
CREATE UNIQUE INDEX table_sessions_one_active ON public.table_sessions (table_id) WHERE status <> 'closed';

CREATE TABLE public.session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  created_by uuid,
  created_by_role text NOT NULL DEFAULT 'client',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  price_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate_snapshot numeric(5,2) NOT NULL DEFAULT 10,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  note text,
  destination public.item_destination NOT NULL DEFAULT 'kitchen',
  status public.line_status NOT NULL DEFAULT 'pending',
  ready_at timestamptz,
  served_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  type public.call_type NOT NULL DEFAULT 'waiter',
  status public.call_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid
);

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role, _bar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND bar_id = _bar_id);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of(_bar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND bar_id = _bar_id);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(_bar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND bar_id = _bar_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_session_member(_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.session_members WHERE session_id = _session_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.session_is_open(_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.table_sessions WHERE id = _session_id AND status = 'open');
$$;

CREATE OR REPLACE FUNCTION public.is_guest_of_bar(_bar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_members sm
    JOIN public.table_sessions ts ON ts.id = sm.session_id
    WHERE sm.user_id = auth.uid() AND ts.bar_id = _bar_id AND ts.status <> 'closed'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_bar(_bar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff_of(_bar_id) OR public.is_guest_of_bar(_bar_id);
$$;

-- GRANTS
GRANT SELECT ON public.bars TO authenticated;
GRANT ALL ON public.bars TO service_role;
GRANT SELECT, UPDATE ON public.bar_settings TO authenticated;
GRANT ALL ON public.bar_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables TO authenticated;
GRANT ALL ON public.tables TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.table_sessions TO authenticated;
GRANT ALL ON public.table_sessions TO service_role;
GRANT SELECT, INSERT ON public.session_members TO authenticated;
GRANT ALL ON public.session_members TO service_role;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.service_calls TO authenticated;
GRANT ALL ON public.service_calls TO service_role;

-- RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
CREATE POLICY bars_select ON public.bars FOR SELECT TO authenticated USING (public.can_view_bar(id));

ALTER TABLE public.bar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bar_settings_select ON public.bar_settings FOR SELECT TO authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY bar_settings_update ON public.bar_settings FOR UPDATE TO authenticated USING (public.is_admin_of(bar_id)) WITH CHECK (public.is_admin_of(bar_id));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR (bar_id IS NOT NULL AND public.is_staff_of(bar_id)));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff_of(bar_id));
CREATE POLICY user_roles_admin_write ON public.user_roles FOR ALL TO authenticated USING (public.is_admin_of(bar_id)) WITH CHECK (public.is_admin_of(bar_id));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY categories_admin ON public.categories FOR ALL TO authenticated USING (public.is_admin_of(bar_id)) WITH CHECK (public.is_admin_of(bar_id));

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_select ON public.items FOR SELECT TO authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY items_admin ON public.items FOR ALL TO authenticated USING (public.is_admin_of(bar_id)) WITH CHECK (public.is_admin_of(bar_id));
CREATE POLICY items_staff_availability ON public.items FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY tables_select ON public.tables FOR SELECT TO authenticated USING (public.can_view_bar(bar_id));
CREATE POLICY tables_admin ON public.tables FOR ALL TO authenticated USING (public.is_admin_of(bar_id)) WITH CHECK (public.is_admin_of(bar_id));

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_select ON public.table_sessions FOR SELECT TO authenticated USING (public.is_staff_of(bar_id) OR public.is_session_member(id));
CREATE POLICY sessions_staff_update ON public.table_sessions FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));

ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_members_select ON public.session_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff_of(bar_id) OR public.is_session_member(session_id));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (public.is_staff_of(bar_id) OR public.is_session_member(session_id));
CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.session_is_open(session_id) AND (public.is_staff_of(bar_id) OR public.is_session_member(session_id)));

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated USING (
  public.is_staff_of(bar_id) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_session_member(o.session_id))
);
CREATE POLICY order_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.session_is_open(o.session_id)
    AND (public.is_staff_of(bar_id) OR public.is_session_member(o.session_id)))
);
CREATE POLICY order_items_staff_update ON public.order_items FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY calls_select ON public.service_calls FOR SELECT TO authenticated USING (public.is_staff_of(bar_id) OR public.is_session_member(session_id));
CREATE POLICY calls_insert ON public.service_calls FOR INSERT TO authenticated WITH CHECK (
  public.is_staff_of(bar_id) OR (public.is_session_member(session_id) AND public.session_is_open(session_id))
);
CREATE POLICY calls_staff_update ON public.service_calls FOR UPDATE TO authenticated USING (public.is_staff_of(bar_id)) WITH CHECK (public.is_staff_of(bar_id));

-- REALTIME
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.service_calls REPLICA IDENTITY FULL;
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;

-- SEED
INSERT INTO public.bars (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111','Mi Bar','mi-bar');
INSERT INTO public.bar_settings (bar_id) VALUES ('11111111-1111-1111-1111-111111111111');

INSERT INTO public.categories (id, bar_id, name, position) VALUES
  ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Bebidas',1),
  ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Tapas',2),
  ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Raciones',3);

INSERT INTO public.items (bar_id, category_id, name, price, allergens, available, destination, is_drink, is_tapa, position) VALUES
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001','Caña',1.80,'{gluten}',true,'bar',true,false,1),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001','Tinto de verano',2.50,'{sulfitos}',true,'bar',true,false,2),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001','Agua mineral',1.50,'{}',true,'bar',true,false,3),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001','Café solo',1.30,'{}',true,'bar',true,false,4),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000002','Croquetas de jamón',3.50,'{gluten,lacteos,huevos}',true,'kitchen',false,true,1),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000002','Tortilla de patatas',3.00,'{huevos}',true,'kitchen',false,true,2),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000002','Ensaladilla rusa',3.20,'{huevos,pescado}',true,'kitchen',false,true,3),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003','Calamares a la andaluza',12.00,'{gluten,moluscos}',true,'kitchen',false,false,1),
  ('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003','Gambas al ajillo',14.50,'{crustaceos}',false,'kitchen',false,false,2);

INSERT INTO public.tables (bar_id, number, name, qr_token) VALUES
  ('11111111-1111-1111-1111-111111111111',1,'Terraza', encode(gen_random_bytes(16),'hex')),
  ('11111111-1111-1111-1111-111111111111',2,'Terraza', encode(gen_random_bytes(16),'hex')),
  ('11111111-1111-1111-1111-111111111111',3,'Interior', encode(gen_random_bytes(16),'hex')),
  ('11111111-1111-1111-1111-111111111111',4,'Interior', encode(gen_random_bytes(16),'hex'));
