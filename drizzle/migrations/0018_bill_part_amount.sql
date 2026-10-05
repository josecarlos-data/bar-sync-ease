-- Devuelve el importe vivo de una parte de cuenta dividida (modo equal o groups),
-- calculado en servidor para que el pago online no dependa del navegador.
CREATE OR REPLACE FUNCTION public.bill_part_amount(_part_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _part record;
  _split record;
  _total numeric;
  _paid_sum numeric;
  _open_count int;
  _rest numeric;
  _base numeric;
  _open_pos int;
  _amount numeric;
BEGIN
  SELECT * INTO _part FROM bill_split_parts WHERE id = _part_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'part not found'; END IF;
  SELECT * INTO _split FROM bill_splits WHERE id = _part.split_id;

  -- Total vivo de la sesión (líneas no borradas)
  SELECT COALESCE(SUM(oi.price_snapshot * oi.qty), 0) INTO _total
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.session_id = _split.session_id AND oi.deleted_at IS NULL;
  _total := round(_total, 2);

  IF _split.mode = 'equal' THEN
    SELECT COALESCE(SUM(amount), 0) INTO _paid_sum
    FROM bill_split_parts WHERE split_id = _split.id AND status = 'paid';
    _paid_sum := round(_paid_sum, 2);
    _rest := round(GREATEST(0, _total - _paid_sum), 2);

    IF _part.status = 'paid' THEN
      RETURN _part.amount;
    END IF;

    SELECT COUNT(*) INTO _open_count
    FROM bill_split_parts WHERE split_id = _split.id AND status <> 'paid';
    IF _open_count = 0 THEN RETURN 0; END IF;

    _base := floor((_rest * 100) / _open_count) / 100;
    -- La última parte abierta (mayor position) absorbe el redondeo
    SELECT COUNT(*) INTO _open_pos
    FROM bill_split_parts
    WHERE split_id = _split.id AND status <> 'paid' AND position < _part.position;
    IF _open_pos = _open_count - 1 THEN
      _amount := round(_rest - _base * (_open_count - 1), 2);
    ELSE
      _amount := _base;
    END IF;
    RETURN _amount;
  END IF;

  -- Modo groups: suma de asignaciones de esta parte
  SELECT COALESCE(SUM(oi.price_snapshot * a.qty), 0) INTO _amount
  FROM bill_split_assignments a
  JOIN order_items oi ON oi.id = a.order_item_id
  WHERE a.part_id = _part_id AND oi.deleted_at IS NULL;
  RETURN round(_amount, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bill_part_amount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bill_part_amount(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.bill_part_amount(uuid) TO service_role;