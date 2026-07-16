-- Enterprise Plan: sales-led tier (100+ members, custom modules), inherits Scale Up modules + add-ons.

DO $$
DECLARE
  v_src_id uuid;
  v_ent_id uuid;
  v_features jsonb := '[]'::jsonb;
  v_key text;
  v_enabled boolean;
BEGIN
  SELECT sp.id
  INTO v_src_id
  FROM public.subscription_plans sp
  WHERE sp.is_active = true
    AND lower(trim(regexp_replace(sp.name, '[-–—]', ' ', 'g'))) ~ '(^|[[:space:]])(scale[[:space:]]*up)([[:space:]]|$)'
  LIMIT 1;

  INSERT INTO public.subscription_plans (
    name,
    description,
    base_price_per_member,
    is_active,
    is_custom,
    demo_required,
    max_members,
    features
  ) VALUES (
    'Enterprise Plan',
    'Organisasi 100+ karyawan dengan kebutuhan modul kustom dan dukungan sales.',
    0,
    true,
    true,
    false,
    NULL,
    '[]'::jsonb
  )
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = true,
    is_custom = true,
    demo_required = false,
    updated_at = now()
  RETURNING id INTO v_ent_id;

  IF v_ent_id IS NULL THEN
    SELECT sp.id INTO v_ent_id
    FROM public.subscription_plans sp
    WHERE sp.name = 'Enterprise Plan'
    LIMIT 1;
  END IF;

  IF v_ent_id IS NULL THEN
    RAISE NOTICE 'enterprise_plan_catalog skipped (no enterprise row)';
    RETURN;
  END IF;

  PERFORM public.seed_plan_module_access_defaults(v_ent_id);

  IF v_src_id IS NOT NULL THEN
    UPDATE public.subscription_plan_module_access AS target
    SET
      is_enabled = source.is_enabled,
      updated_at = now()
    FROM public.subscription_plan_module_access AS source
    WHERE target.subscription_plan_id = v_ent_id
      AND source.subscription_plan_id = v_src_id
      AND target.module_key = source.module_key;
  END IF;

  v_features := jsonb_build_array('101+ Member Allowed', 'Modul kustom');

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    SELECT m.is_enabled
    INTO v_enabled
    FROM public.subscription_plan_module_access m
    WHERE m.subscription_plan_id = v_ent_id
      AND m.module_key = v_key;

    IF v_enabled IS TRUE THEN
      v_features := v_features || jsonb_build_array('Modul ' || public._plan_module_label(v_key));
    END IF;
  END LOOP;

  v_features := v_features || jsonb_build_array('Dashboard selalu aktif');

  UPDATE public.subscription_plans
  SET
    features = v_features,
    updated_at = now()
  WHERE id = v_ent_id;

  INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
  SELECT v_ent_id, sa.id, CASE sa.code WHEN 'omnichannel_roster' THEN 0 WHEN 'lead_magnet' THEN 10 ELSE 99 END
  FROM public.subscription_add_ons sa
  WHERE sa.code IN ('omnichannel_roster', 'lead_magnet')
    AND sa.is_active = true
  ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;
END;
$$;
