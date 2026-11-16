ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_session_request_uidx ON public.orders(session_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_request_idx ON public.orders(client_request_id) WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tapa_norm(_x text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(lower(trim(coalesce(_x,''))), 'áéíóúüñàèìòùâêîôûäëïöç', 'aeiouunaeiouaeiouaeioc');
$$;

CREATE OR REPLACE FUNCTION public.tapa_round_name(_rounds jsonb, _after text, _r integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE list text[]; n int; idx int;
BEGIN
  SELECT coalesce(array_agg(v) FILTER (WHERE v <> ''), '{}') INTO list
    FROM (SELECT x #>> '{}' AS v, ord FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_rounds)='array' THEN _rounds ELSE '[]'::jsonb END) WITH ORDINALITY t(x, ord) ORDER BY ord) s;
  n := coalesce(array_length(list, 1), 0);
  IF n = 0 THEN RETURN ''; END IF;
  IF _after = 'repeat' THEN idx := least(_r - 1, n - 1); ELSE idx := (_r - 1) % n; END IF;
  RETURN list[idx + 1];
END $$;

CREATE OR REPLACE FUNCTION public.place_order(
  _session_id uuid,
  _request_id uuid,
  _lines jsonb,
  _tapas integer DEFAULT NULL,
  _force_new_round boolean DEFAULT false,
  _served text DEFAULT 'none'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.table_sessions;
  st public.bar_settings;
  is_staff boolean;
  role_txt text;
  existing uuid;
  max_qty int;
  mode text;
  ln jsonb;
  it public.items;
  q int;
  nt text;
  sold text[] := '{}';
  warnings text[] := '{}';
  pending jsonb := '[]'::jsonb;  -- líneas ya calculadas
  remaining int := 0;
  inc int;
  drinks_order int := 0;
  drinks_session int := 0;
  used_session int := 0;
  n_tapas int;
  last_r int;
  c_last int;
  c_prev int;
  fill int;
  left_n int;
  rounds jsonb := '[]'::jsonb;
  rr jsonb;
  r0 int;
  rnd int;
  len_raw int;
  k int;
  rname text;
  ritem public.items;
  free int;
  extra_price numeric;
  lbl text;
  oid_ uuid;
  served_now boolean;
  ts timestamptz := now();
  out_lines jsonb;
  tot numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'empty_order'; END IF;

  -- Bloquea la mesa: pedidos simultáneos de la misma sesión van uno detrás de otro
  SELECT * INTO s FROM public.table_sessions WHERE id = _session_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;

  is_staff := public.is_staff_of(s.bar_id);
  IF NOT is_staff AND NOT public.is_session_member(_session_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  -- Idempotencia (antes de mirar el estado, para que un reintento devuelva lo ya creado)
  SELECT id INTO existing FROM public.orders WHERE session_id = _session_id AND client_request_id = _request_id;
  IF existing IS NOT NULL THEN
    RETURN public.place_order_result(existing, '{}', true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE client_request_id = _request_id AND session_id <> _session_id) THEN
    RAISE EXCEPTION 'request_id_conflict';
  END IF;

  IF s.status NOT IN ('open','pending') THEN RAISE EXCEPTION 'session_closed'; END IF;

  IF is_staff THEN
    SELECT role::text INTO role_txt FROM public.user_roles WHERE user_id = uid AND bar_id = s.bar_id
      ORDER BY array_position(ARRAY['waiter','admin','bar','kitchen'], role::text) LIMIT 1;
    max_qty := 99;
  ELSE
    role_txt := 'client';
    max_qty := 20;
    _force_new_round := false;
    _served := 'none';
  END IF;
  IF _served NOT IN ('none','all','drinks') THEN RAISE EXCEPTION 'invalid_served'; END IF;
  IF jsonb_array_length(_lines) > 40 THEN RAISE EXCEPTION 'too_many_lines'; END IF;

  SELECT * INTO st FROM public.bar_settings WHERE bar_id = s.bar_id;
  mode := CASE WHEN st.tapa_mode IN ('house','choice') THEN st.tapa_mode ELSE 'off' END;

  -- Validación de líneas contra la carta
  FOR ln IN SELECT x FROM jsonb_array_elements(_lines) WITH ORDINALITY t(x, ord) ORDER BY ord LOOP
    BEGIN q := (ln->>'qty')::int; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_qty'; END;
    IF q IS NULL OR q < 1 THEN RAISE EXCEPTION 'invalid_qty'; END IF;
    IF q > max_qty THEN RAISE EXCEPTION 'qty_limit:%', max_qty; END IF;
    nt := nullif(trim(coalesce(ln->>'note','')), '');
    IF length(nt) > 200 THEN RAISE EXCEPTION 'note_too_long'; END IF;
    SELECT * INTO it FROM public.items WHERE id = nullif(ln->>'item_id','')::uuid AND bar_id = s.bar_id;
    IF it.id IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;
    IF NOT it.available THEN
      sold := array_append(sold, it.name);
    END IF;
    IF it.is_drink AND it.includes_tapa IS DISTINCT FROM false THEN drinks_order := drinks_order + q; END IF;
  END LOOP;

  IF array_length(sold, 1) > 0 THEN
    IF NOT is_staff THEN
      RAISE EXCEPTION 'sold_out:%', array_to_string(sold, '|');
    END IF;
    warnings := array_append(warnings, 'Agotado: ' || array_to_string(sold, ', '));
  END IF;

  -- Estado de tapas de la sesión (líneas vivas)
  IF mode <> 'off' THEN
    SELECT coalesce(sum(oi.qty) FILTER (WHERE i.is_drink AND i.includes_tapa IS DISTINCT FROM false), 0),
           coalesce(sum(oi.qty) FILTER (WHERE oi.tapa_kind = 'included'), 0)
      INTO drinks_session, used_session
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.items i ON i.id = oi.item_id
      WHERE o.session_id = _session_id AND oi.deleted_at IS NULL;
  END IF;
  IF mode = 'choice' THEN
    remaining := greatest(0, drinks_session + drinks_order - used_session);
  END IF;

  -- Líneas de la carta (Almería: reparte cupo de tapas incluidas en orden)
  FOR ln IN SELECT x FROM jsonb_array_elements(_lines) WITH ORDINALITY t(x, ord) ORDER BY ord LOOP
    q := (ln->>'qty')::int;
    nt := nullif(trim(coalesce(ln->>'note','')), '');
    SELECT * INTO it FROM public.items WHERE id = (ln->>'item_id')::uuid;
    served_now := _served = 'all' OR (_served = 'drinks' AND it.destination = 'bar');
    IF remaining > 0 AND it.is_tapa THEN
      inc := least(remaining, q);
      remaining := remaining - inc;
      pending := pending || jsonb_build_object('item_id', it.id, 'name', it.name, 'price', coalesce(it.tapa_supplement,0), 'tax', it.tax_rate,
        'qty', inc, 'note', nt, 'dest', it.destination, 'kind', 'included', 'served', served_now);
      IF q - inc > 0 THEN
        pending := pending || jsonb_build_object('item_id', it.id, 'name', it.name, 'price', it.price, 'tax', it.tax_rate,
          'qty', q - inc, 'note', nt, 'dest', it.destination, 'kind', null, 'served', served_now);
      END IF;
    ELSE
      pending := pending || jsonb_build_object('item_id', it.id, 'name', it.name, 'price', it.price, 'tax', it.tax_rate,
        'qty', q, 'note', nt, 'dest', it.destination, 'kind', null, 'served', served_now);
    END IF;
  END LOOP;

  -- Granada: rondas de la casa
  IF mode = 'house' THEN
    n_tapas := CASE WHEN is_staff THEN coalesce(_tapas, drinks_order) ELSE drinks_order END;
    IF n_tapas < 0 THEN n_tapas := 0; END IF;
    IF n_tapas > 30 THEN RAISE EXCEPTION 'tapas_limit:30'; END IF;
    IF n_tapas > 0 THEN
      SELECT coalesce(max(oi.tapa_round), 0) INTO last_r
        FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
        WHERE o.session_id = _session_id AND oi.deleted_at IS NULL AND oi.tapa_round IS NOT NULL;
      left_n := n_tapas;
      IF NOT _force_new_round AND last_r >= 2 THEN
        SELECT coalesce(sum(oi.qty) FILTER (WHERE oi.tapa_round = last_r), 0),
               coalesce(sum(oi.qty) FILTER (WHERE oi.tapa_round = last_r - 1), 0)
          INTO c_last, c_prev
          FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
          WHERE o.session_id = _session_id AND oi.deleted_at IS NULL;
        IF c_last < c_prev THEN
          fill := least(left_n, c_prev - c_last);
          IF fill > 0 THEN rounds := rounds || jsonb_build_object('round', last_r, 'qty', fill); END IF;
          left_n := left_n - fill;
        END IF;
      END IF;
      IF left_n > 0 THEN rounds := rounds || jsonb_build_object('round', last_r + 1, 'qty', left_n); END IF;

      free := drinks_order;
      extra_price := coalesce(st.tapa_extra_price, 0);
      len_raw := CASE WHEN jsonb_typeof(st.tapa_rounds) = 'array' THEN jsonb_array_length(st.tapa_rounds) ELSE 0 END;
      FOR rr IN SELECT x FROM jsonb_array_elements(rounds) WITH ORDINALITY t(x, ord) ORDER BY ord LOOP
        r0 := (rr->>'round')::int; q := (rr->>'qty')::int;
        rnd := r0;
        FOR k IN 0 .. greatest(1, len_raw) - 1 LOOP
          rname := public.tapa_round_name(st.tapa_rounds, st.tapa_rounds_after, r0 + k);
          ritem := NULL;
          IF rname <> '' THEN
            SELECT * INTO ritem FROM public.items WHERE bar_id = s.bar_id AND public.tapa_norm(name) = public.tapa_norm(rname) ORDER BY position LIMIT 1;
          END IF;
          IF ritem.id IS NULL OR ritem.available THEN rnd := r0 + k; EXIT; END IF;
        END LOOP;
        rname := public.tapa_round_name(st.tapa_rounds, st.tapa_rounds_after, rnd);
        ritem := NULL;
        IF rname <> '' THEN
          SELECT * INTO ritem FROM public.items WHERE bar_id = s.bar_id AND public.tapa_norm(name) = public.tapa_norm(rname) ORDER BY position LIMIT 1;
        END IF;
        IF rnd <> r0 THEN
          warnings := array_append(warnings, r0 || '.ª tapa agotada: se pone la siguiente');
        END IF;
        lbl := rnd || '.ª tapa' || CASE WHEN rname <> '' THEN ' · ' || rname ELSE '' END;
        inc := least(free, q);
        free := free - inc;
        IF inc > 0 THEN
          pending := pending || jsonb_build_object('item_id', null, 'name', lbl, 'price', 0, 'tax', 10, 'qty', inc, 'note', null,
            'dest', 'kitchen', 'kind', 'round', 'round', rnd, 'tapa_item', ritem.id, 'served', false);
        END IF;
        IF q - inc > 0 THEN
          pending := pending || jsonb_build_object('item_id', null, 'name', lbl || ' (extra)', 'price', extra_price, 'tax', 10, 'qty', q - inc, 'note', null,
            'dest', 'kitchen', 'kind', 'extra', 'round', rnd, 'tapa_item', ritem.id, 'served', false);
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Inserta comanda (choque de identificador simultáneo -> devuelve la existente)
  BEGIN
    INSERT INTO public.orders(bar_id, session_id, created_by, created_by_role, client_request_id)
      VALUES (s.bar_id, _session_id, uid, coalesce(role_txt, 'waiter'), _request_id)
      RETURNING id INTO oid_;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existing FROM public.orders WHERE session_id = _session_id AND client_request_id = _request_id;
    IF existing IS NULL THEN RAISE; END IF;
    RETURN public.place_order_result(existing, '{}', true);
  END;

  INSERT INTO public.order_items(bar_id, order_id, item_id, name_snapshot, price_snapshot, tax_rate_snapshot, qty, note,
    destination, status, ready_at, served_at, tapa_kind, tapa_round, tapa_item_id)
  SELECT s.bar_id, oid_, nullif(p->>'item_id','')::uuid, p->>'name', (p->>'price')::numeric, (p->>'tax')::numeric, (p->>'qty')::int,
    p->>'note', (p->>'dest')::item_destination,
    CASE WHEN (p->>'served')::boolean THEN 'served'::line_status ELSE 'pending'::line_status END,
    CASE WHEN (p->>'served')::boolean THEN ts END, CASE WHEN (p->>'served')::boolean THEN ts END,
    p->>'kind', nullif(p->>'round','')::int, nullif(p->>'tapa_item','')::uuid
  FROM jsonb_array_elements(pending) WITH ORDINALITY t(p, ord) ORDER BY ord;

  UPDATE public.table_sessions SET last_activity_at = ts WHERE id = _session_id;

  RETURN public.place_order_result(oid_, warnings, false);
END $$;

CREATE OR REPLACE FUNCTION public.place_order_result(_order uuid, _warnings text[], _duplicate boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'order_id', _order,
    'duplicate', _duplicate,
    'total', coalesce((SELECT round(sum(price_snapshot * qty), 2) FROM public.order_items WHERE order_id = _order AND deleted_at IS NULL), 0),
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name_snapshot, 'qty', qty, 'price', price_snapshot,
               'tapa_kind', tapa_kind, 'tapa_round', tapa_round, 'status', status) ORDER BY created_at, id)
             FROM public.order_items WHERE order_id = _order AND deleted_at IS NULL), '[]'::jsonb),
    'warnings', to_jsonb(coalesce(_warnings, '{}'))
  );
$$;

REVOKE ALL ON FUNCTION public.place_order(uuid, uuid, jsonb, integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, jsonb, integer, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.place_order_result(uuid, text[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tapa_round_name(jsonb, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tapa_norm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tapa_round_name(jsonb, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tapa_norm(text) TO authenticated;