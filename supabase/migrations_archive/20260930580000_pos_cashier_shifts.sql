-- POS cashier shift (cash drawer session) — not HR attendance shifts

CREATE TABLE IF NOT EXISTS public.pos_outlet_shift_settings (
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  auto_start_enabled boolean NOT NULL DEFAULT false,
  default_opening_cash numeric(14, 2) NOT NULL DEFAULT 100000
    CHECK (default_opening_cash >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlet_shift_settings_pkey PRIMARY KEY (outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_shift_settings_org
  ON public.pos_outlet_shift_settings (organization_id);

ALTER TABLE public.pos_outlet_shift_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlet_shift_settings_org_select" ON public.pos_outlet_shift_settings;
CREATE POLICY "pos_outlet_shift_settings_org_select"
  ON public.pos_outlet_shift_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_shift_settings_org_insert" ON public.pos_outlet_shift_settings;
CREATE POLICY "pos_outlet_shift_settings_org_insert"
  ON public.pos_outlet_shift_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_shift_settings_org_update" ON public.pos_outlet_shift_settings;
CREATE POLICY "pos_outlet_shift_settings_org_update"
  ON public.pos_outlet_shift_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_shift_settings_org_delete" ON public.pos_outlet_shift_settings;
CREATE POLICY "pos_outlet_shift_settings_org_delete"
  ON public.pos_outlet_shift_settings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_outlet_shift_settings_updated_at ON public.pos_outlet_shift_settings;
CREATE TRIGGER update_pos_outlet_shift_settings_updated_at
  BEFORE UPDATE ON public.pos_outlet_shift_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_cashier_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  opened_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  closed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(14, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  expected_cash numeric(14, 2),
  closing_cash numeric(14, 2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_cashier_shifts_pkey PRIMARY KEY (id),
  CONSTRAINT pos_cashier_shifts_closed_consistency CHECK (
    (status = 'open' AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_cashier_shifts_one_open_per_outlet
  ON public.pos_cashier_shifts (outlet_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_pos_cashier_shifts_org_outlet_opened
  ON public.pos_cashier_shifts (organization_id, outlet_id, opened_at DESC);

ALTER TABLE public.pos_cashier_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_cashier_shifts_org_select" ON public.pos_cashier_shifts;
CREATE POLICY "pos_cashier_shifts_org_select"
  ON public.pos_cashier_shifts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_cashier_shifts_org_insert" ON public.pos_cashier_shifts;
CREATE POLICY "pos_cashier_shifts_org_insert"
  ON public.pos_cashier_shifts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_cashier_shifts_org_update" ON public.pos_cashier_shifts;
CREATE POLICY "pos_cashier_shifts_org_update"
  ON public.pos_cashier_shifts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_cashier_shifts_updated_at ON public.pos_cashier_shifts;
CREATE TRIGGER update_pos_cashier_shifts_updated_at
  BEFORE UPDATE ON public.pos_cashier_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.pos_cashier_shifts (id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_cash_movements_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_shift
  ON public.pos_cash_movements (shift_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_org
  ON public.pos_cash_movements (organization_id);

ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_cash_movements_org_select" ON public.pos_cash_movements;
CREATE POLICY "pos_cash_movements_org_select"
  ON public.pos_cash_movements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_cash_movements_org_insert" ON public.pos_cash_movements;
CREATE POLICY "pos_cash_movements_org_insert"
  ON public.pos_cash_movements FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS pos_shift_id uuid REFERENCES public.pos_cashier_shifts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activities_pos_shift
  ON public.sales_activities (pos_shift_id)
  WHERE pos_shift_id IS NOT NULL;

COMMENT ON COLUMN public.sales_activities.pos_shift_id IS
  'POS cashier shift that recorded this store checkout (cash drawer session).';

-- Start shift (rejects if another open shift exists for outlet)
CREATE OR REPLACE FUNCTION public.pos_start_shift(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_opening_cash numeric
)
RETURNS public.pos_cashier_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL OR p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;
  IF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_outlets o
    WHERE o.id = p_outlet_id
      AND o.organization_id = p_organization_id
      AND o.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'outlet_not_found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pos_cashier_shifts s
    WHERE s.outlet_id = p_outlet_id AND s.status = 'open'
  ) THEN
    RAISE EXCEPTION 'shift_already_open';
  END IF;

  INSERT INTO public.pos_cashier_shifts (
    organization_id,
    outlet_id,
    opened_by,
    opening_cash,
    status
  ) VALUES (
    p_organization_id,
    p_outlet_id,
    v_user,
    GREATEST(COALESCE(p_opening_cash, 0), 0),
    'open'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_start_shift(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_start_shift(uuid, uuid, numeric) TO authenticated;

-- Compute expected cash for an open/closed shift
CREATE OR REPLACE FUNCTION public.pos_shift_expected_cash(p_shift_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_cashier_shifts;
  v_cash_sales numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT COALESCE(SUM(sa.total_paid_amount), 0) INTO v_cash_sales
  FROM public.sales_activities sa
  WHERE sa.pos_shift_id = p_shift_id
    AND sa.payment_method = 'cash'
    AND sa.status = 'Converted';

  SELECT
    COALESCE(SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.direction = 'out' THEN m.amount ELSE 0 END), 0)
  INTO v_cash_in, v_cash_out
  FROM public.pos_cash_movements m
  WHERE m.shift_id = p_shift_id;

  RETURN v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_shift_expected_cash(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_shift_expected_cash(uuid) TO authenticated;

-- End shift
CREATE OR REPLACE FUNCTION public.pos_end_shift(p_shift_id uuid)
RETURNS public.pos_cashier_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
  v_expected numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.pos_cashier_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF v_row.status <> 'open' THEN
    RAISE EXCEPTION 'shift_not_open';
  END IF;

  v_expected := public.pos_shift_expected_cash(p_shift_id);

  UPDATE public.pos_cashier_shifts
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = v_user,
    expected_cash = v_expected,
    closing_cash = v_expected,
    updated_at = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_end_shift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_end_shift(uuid) TO authenticated;

-- Add cash in/out movement
CREATE OR REPLACE FUNCTION public.pos_add_cash_movement(
  p_shift_id uuid,
  p_direction text,
  p_amount numeric,
  p_description text
)
RETURNS public.pos_cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_shift public.pos_cashier_shifts;
  v_row public.pos_cash_movements;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'invalid_direction';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF v_shift.status <> 'open' THEN
    RAISE EXCEPTION 'shift_not_open';
  END IF;

  INSERT INTO public.pos_cash_movements (
    organization_id,
    shift_id,
    direction,
    amount,
    description,
    created_by
  ) VALUES (
    v_shift.organization_id,
    p_shift_id,
    p_direction,
    p_amount,
    COALESCE(NULLIF(trim(p_description), ''), '—'),
    v_user
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_add_cash_movement(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_add_cash_movement(uuid, text, numeric, text) TO authenticated;

-- Ensure open shift exists when auto-start is enabled (or return existing open)
CREATE OR REPLACE FUNCTION public.pos_ensure_open_shift(
  p_organization_id uuid,
  p_outlet_id uuid
)
RETURNS public.pos_cashier_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
  v_settings public.pos_outlet_shift_settings;
  v_opening numeric := 100000;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT * INTO v_row
  FROM public.pos_cashier_shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_settings
  FROM public.pos_outlet_shift_settings
  WHERE outlet_id = p_outlet_id;

  IF NOT FOUND OR v_settings.auto_start_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'shift_required';
  END IF;

  v_opening := GREATEST(COALESCE(v_settings.default_opening_cash, 100000), 0);
  RETURN public.pos_start_shift(p_organization_id, p_outlet_id, v_opening);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_ensure_open_shift(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_ensure_open_shift(uuid, uuid) TO authenticated;
