-- Sync Scale Up mandiri plan module toggles from Start Up / Trial / Starter (CMS parity for /subscription/plans).

DO $$
DECLARE
  v_src_id uuid;
  v_tgt_id uuid;
BEGIN
  SELECT sp.id
  INTO v_src_id
  FROM public.subscription_plans sp
  WHERE sp.is_active = true
    AND (
      lower(trim(sp.name)) ~ '(start[[:space:]]*up|startup|starter|trial)'
      OR sp.base_price_per_member = 0
    )
  ORDER BY
    CASE
      WHEN lower(trim(sp.name)) ~ 'start[[:space:]]*up' THEN 0
      WHEN lower(trim(sp.name)) ~ 'trial' THEN 1
      ELSE 2
    END,
    sp.base_price_per_member ASC NULLS LAST
  LIMIT 1;

  SELECT sp.id
  INTO v_tgt_id
  FROM public.subscription_plans sp
  WHERE sp.is_active = true
    AND lower(trim(regexp_replace(sp.name, '[-–—]', ' ', 'g'))) ~ '(^|[[:space:]])(scale[[:space:]]*up)([[:space:]]|$)'
  LIMIT 1;

  IF v_src_id IS NULL OR v_tgt_id IS NULL THEN
    RAISE NOTICE 'scale_up_module_sync skipped (source %, target %)', v_src_id, v_tgt_id;
    RETURN;
  END IF;

  PERFORM public.seed_plan_module_access_defaults(v_tgt_id);

  UPDATE public.subscription_plan_module_access AS target
  SET
    is_enabled = source.is_enabled,
    updated_at = now()
  FROM public.subscription_plan_module_access AS source
  WHERE target.subscription_plan_id = v_tgt_id
    AND source.subscription_plan_id = v_src_id
    AND target.module_key = source.module_key;
END;
$$;
