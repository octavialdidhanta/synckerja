-- PIN Access: required feature keys + verify PIN RPC (no plaintext reveal).

ALTER TABLE public.pos_pin_access_settings
  ADD COLUMN IF NOT EXISTS required_features text[] NOT NULL DEFAULT '{}';

-- Backfill from legacy boolean flags into feature keys.
UPDATE public.pos_pin_access_settings
SET required_features = (
  SELECT COALESCE(array_agg(DISTINCT k), '{}'::text[])
  FROM unnest(
    ARRAY[]::text[]
    || CASE WHEN require_pin_for_void THEN ARRAY['pin.feature.cancel_invoices'] ELSE ARRAY[]::text[] END
    || CASE WHEN require_pin_for_refund THEN ARRAY['pin.feature.issue_refunds'] ELSE ARRAY[]::text[] END
    || CASE WHEN require_pin_for_discount THEN ARRAY['pin.feature.apply_discounts', 'pin.feature.manage_discounts'] ELSE ARRAY[]::text[] END
    || CASE WHEN require_pin_for_cash_drawer THEN ARRAY['pin.feature.cash_drawer'] ELSE ARRAY[]::text[] END
  ) AS k
)
WHERE cardinality(required_features) = 0;

CREATE OR REPLACE FUNCTION public.pos_staff_verify_pin(
  p_staff_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_employee_staff;
  v_pin text := trim(COALESCE(p_pin, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_pin) <> 4 OR v_pin !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.pos_employee_staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF NOT v_row.is_active OR NOT v_row.pin_enabled OR v_row.pin_hash IS NULL THEN
    RETURN false;
  END IF;
  IF NOT COALESCE(v_row.allow_pin_for_permissions, false) THEN
    RETURN false;
  END IF;

  RETURN crypt(v_pin, v_row.pin_hash) = v_row.pin_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_verify_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_verify_pin(uuid, text) TO authenticated;

-- Try PIN against administrators assigned to outlet (or all-outlet admins).
CREATE OR REPLACE FUNCTION public.pos_verify_admin_pin_for_outlet(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_pin text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pin text := trim(COALESCE(p_pin, ''));
  v_staff public.pos_employee_staff;
  v_has_outlet boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF length(v_pin) <> 4 OR v_pin !~ '^[0-9]+$' THEN
    RETURN NULL;
  END IF;

  FOR v_staff IN
    SELECT s.*
    FROM public.pos_employee_staff s
    WHERE s.organization_id = p_organization_id
      AND s.is_active = true
      AND s.pin_enabled = true
      AND s.pin_hash IS NOT NULL
      AND COALESCE(s.allow_pin_for_permissions, false) = true
      AND (
        s.pos_role = 'administrator'
        OR EXISTS (
          SELECT 1
          FROM public.pos_employee_roles r
          WHERE r.id = s.role_id
            AND r.slug = 'administrator'
        )
      )
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.pos_employee_staff_outlets o
      WHERE o.staff_id = v_staff.id
        AND o.outlet_id = p_outlet_id
    ) INTO v_has_outlet;

    -- Admin with no outlets = all outlets; otherwise must include outlet
    IF NOT v_has_outlet THEN
      IF EXISTS (
        SELECT 1 FROM public.pos_employee_staff_outlets o WHERE o.staff_id = v_staff.id
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    IF crypt(v_pin, v_staff.pin_hash) = v_staff.pin_hash THEN
      RETURN v_staff.id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_verify_admin_pin_for_outlet(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_verify_admin_pin_for_outlet(uuid, uuid, text) TO authenticated;
