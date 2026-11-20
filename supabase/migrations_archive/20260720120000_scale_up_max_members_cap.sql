-- Paid per-member plans may set an optional max_members cap (office slider).
-- Scale Up Plan: cap at 50 members.

CREATE OR REPLACE FUNCTION public._resolve_plan_max_members(
  p_max_members integer,
  p_jumlah_hari_trial integer,
  p_base_price_per_member numeric
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_validated integer;
BEGIN
  IF p_base_price_per_member IS NOT NULL AND p_base_price_per_member > 0 THEN
    IF p_max_members IS NOT NULL THEN
      RETURN public._validate_plan_max_members(p_max_members);
    END IF;
    RETURN NULL;
  END IF;

  v_validated := public._validate_plan_max_members(p_max_members);
  IF v_validated IS NOT NULL THEN
    RETURN v_validated;
  END IF;

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial > 0 THEN
    RETURN 1;
  END IF;

  RETURN 1;
END;
$function$;

DO $$
DECLARE
  v_scale_up_id uuid;
  v_modules jsonb;
BEGIN
  SELECT sp.id
  INTO v_scale_up_id
  FROM public.subscription_plans sp
  WHERE sp.is_active = true
    AND lower(trim(regexp_replace(sp.name, '[-–—]', ' ', 'g'))) ~ '(^|[[:space:]])(scale[[:space:]]*up)([[:space:]]|$)'
  LIMIT 1;

  IF v_scale_up_id IS NULL THEN
    RAISE NOTICE 'scale_up_max_members_cap skipped (no Scale Up plan row)';
    RETURN;
  END IF;

  v_modules := public._plan_modules_json_for_plan(v_scale_up_id);

  UPDATE public.subscription_plans
  SET
    max_members = 50,
    features = public._build_plan_features_from_modules(
      base_price_per_member,
      v_modules,
      50
    ),
    updated_at = now()
  WHERE id = v_scale_up_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
