-- Threshold rows from payment_terms JSON, auto bonus, conversion sync from kol_conversions

CREATE OR REPLACE FUNCTION public.sync_threshold_rows_from_payment_terms(p_payment_terms_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pt public.kol_payment_terms%ROWTYPE;
  v_json jsonb;
  v_key text;
  v_val jsonb;
  v_metric text;
  v_target numeric;
  v_bonus numeric;
  v_nested boolean := false;
BEGIN
  SELECT * INTO v_pt FROM public.kol_payment_terms WHERE id = p_payment_terms_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_json := COALESCE(v_pt.performance_thresholds, '{}'::jsonb);
  IF v_json = '{}'::jsonb OR v_json = '[]'::jsonb THEN
    RETURN;
  END IF;

  DELETE FROM public.kol_performance_thresholds
  WHERE payment_terms_id = p_payment_terms_id;

  IF jsonb_typeof(v_json) = 'array' THEN
    FOR v_val IN SELECT value FROM jsonb_array_elements(v_json)
    LOOP
      v_metric := lower(COALESCE(v_val->>'metric', ''));
      IF v_metric = 'conversions' THEN v_metric := 'conversion'; END IF;
      v_target := (v_val->>'threshold')::numeric;
      v_bonus := COALESCE((v_val->>'bonus_percentage')::numeric, 0);
      IF v_metric <> '' AND v_target IS NOT NULL AND v_target > 0 THEN
        INSERT INTO public.kol_performance_thresholds (
          organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id,
          metric_type, target_value, bonus_percentage, is_active
        ) VALUES (
          v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id,
          v_metric, v_target, v_bonus, true
        );
      END IF;
    END LOOP;
    RETURN;
  END IF;

  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(v_json)
  LOOP
    IF jsonb_typeof(v_val) = 'object' AND v_val ? 'threshold' THEN
      v_nested := true;
      v_metric := lower(v_key);
      IF v_metric = 'conversions' THEN v_metric := 'conversion'; END IF;
      v_target := (v_val->>'threshold')::numeric;
      v_bonus := COALESCE((v_val->>'bonus_percentage')::numeric, 0);
      IF v_metric <> '' AND v_target IS NOT NULL AND v_target > 0 THEN
        INSERT INTO public.kol_performance_thresholds (
          organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id,
          metric_type, target_value, bonus_percentage, is_active
        ) VALUES (
          v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id,
          v_metric, v_target, v_bonus, true
        );
      END IF;
    END IF;
  END LOOP;

  IF v_nested THEN
    RETURN;
  END IF;

  -- Flat object keys: target_reach, reach_bonus_percentage, etc.
  IF v_json ? 'target_reach' AND (v_json->>'target_reach')::numeric > 0 THEN
    INSERT INTO public.kol_performance_thresholds (organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id, metric_type, target_value, bonus_percentage, is_active)
    VALUES (v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id, 'reach', (v_json->>'target_reach')::numeric, COALESCE((v_json->>'reach_bonus_percentage')::numeric, 0), true);
  END IF;
  IF v_json ? 'target_engagement' AND (v_json->>'target_engagement')::numeric > 0 THEN
    INSERT INTO public.kol_performance_thresholds (organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id, metric_type, target_value, bonus_percentage, is_active)
    VALUES (v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id, 'engagement', (v_json->>'target_engagement')::numeric, COALESCE((v_json->>'engagement_bonus_percentage')::numeric, 0), true);
  END IF;
  IF (v_json ? 'target_conversion' OR v_json ? 'target_conversions') THEN
    v_target := COALESCE((v_json->>'target_conversion')::numeric, (v_json->>'target_conversions')::numeric);
    IF v_target > 0 THEN
      INSERT INTO public.kol_performance_thresholds (organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id, metric_type, target_value, bonus_percentage, is_active)
      VALUES (v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id, 'conversion', v_target, COALESCE((v_json->>'conversion_bonus_percentage')::numeric, 0), true);
    END IF;
  END IF;
  IF v_json ? 'target_views' AND (v_json->>'target_views')::numeric > 0 THEN
    INSERT INTO public.kol_performance_thresholds (organization_id, payment_terms_id, kol_content_post_id, kol_profile_id, campaign_id, metric_type, target_value, bonus_percentage, is_active)
    VALUES (v_pt.organization_id, v_pt.id, v_pt.kol_content_post_id, v_pt.kol_profile_id, v_pt.campaign_id, 'views', (v_json->>'target_views')::numeric, COALESCE((v_json->>'views_bonus_percentage')::numeric, 0), true);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_threshold_rows_from_payment_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.performance_thresholds IS NOT NULL
    AND NEW.performance_thresholds <> '{}'::jsonb
    AND NEW.performance_thresholds <> '[]'::jsonb
  THEN
    PERFORM public.sync_threshold_rows_from_payment_terms(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_threshold_rows_from_payment_terms_trigger ON public.kol_payment_terms;
CREATE TRIGGER sync_threshold_rows_from_payment_terms_trigger
  AFTER INSERT OR UPDATE OF performance_thresholds ON public.kol_payment_terms
  FOR EACH ROW
  WHEN (
    (NEW.type = 'agreement' OR (NEW.type = 'template' AND NEW.kol_content_post_id IS NULL))
    AND NEW.performance_thresholds IS NOT NULL
    AND NEW.performance_thresholds <> '{}'::jsonb
    AND NEW.performance_thresholds <> '[]'::jsonb
  )
  EXECUTE FUNCTION public.trigger_sync_threshold_rows_from_payment_terms();

CREATE OR REPLACE FUNCTION public.apply_performance_bonus(p_payment_terms_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pt public.kol_payment_terms%ROWTYPE;
  v_bonus numeric(15, 2);
  v_total_pct numeric;
BEGIN
  SELECT * INTO v_pt FROM public.kol_payment_terms WHERE id = p_payment_terms_id;
  IF NOT FOUND OR v_pt.type <> 'agreement' THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(LEAST(t.bonus_percentage, 100)), 0),
    COALESCE(SUM(COALESCE(v_pt.base_amount, 0) * LEAST(t.bonus_percentage, 100) / 100), 0)
  INTO v_total_pct, v_bonus
  FROM public.kol_performance_thresholds t
  WHERE t.payment_terms_id = p_payment_terms_id
    AND t.is_achieved = true
    AND t.is_active IS NOT FALSE;

  v_total_pct := LEAST(v_total_pct, 100);
  v_bonus := LEAST(v_bonus, COALESCE(v_pt.base_amount, 0));

  UPDATE public.kol_payment_terms
  SET bonus_amount = v_bonus, updated_at = timezone('utc'::text, now())
  WHERE id = p_payment_terms_id
    AND bonus_amount IS DISTINCT FROM v_bonus;

  IF v_pt.campaign_id IS NOT NULL AND v_pt.kol_profile_id IS NOT NULL THEN
    PERFORM public.refresh_budget_allocation_payout(v_pt.campaign_id, v_pt.kol_profile_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_apply_performance_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_achieved = true AND (TG_OP = 'INSERT' OR OLD.is_achieved IS DISTINCT FROM NEW.is_achieved) THEN
    IF NEW.payment_terms_id IS NOT NULL THEN
      PERFORM public.apply_performance_bonus(NEW.payment_terms_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS apply_performance_bonus_trigger ON public.kol_performance_thresholds;
CREATE TRIGGER apply_performance_bonus_trigger
  AFTER INSERT OR UPDATE OF is_achieved ON public.kol_performance_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_apply_performance_bonus();

CREATE OR REPLACE FUNCTION public.sync_conversion_thresholds_from_conversions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_post_id uuid;
  v_count numeric;
BEGIN
  v_post_id := COALESCE(NEW.content_post_id, OLD.content_post_id);
  IF v_post_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::numeric INTO v_count
  FROM public.kol_conversions
  WHERE content_post_id = v_post_id;

  UPDATE public.kol_performance_thresholds
  SET current_value = v_count, updated_at = timezone('utc'::text, now())
  WHERE kol_content_post_id = v_post_id
    AND metric_type = 'conversion'
    AND is_active IS NOT FALSE;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_conversion_thresholds_from_conversions_trigger ON public.kol_conversions;
CREATE TRIGGER sync_conversion_thresholds_from_conversions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.kol_conversions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversion_thresholds_from_conversions();

-- Backfill threshold rows for existing agreements/templates
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.kol_payment_terms
    WHERE performance_thresholds IS NOT NULL
      AND performance_thresholds <> '{}'::jsonb
      AND performance_thresholds <> '[]'::jsonb
      AND (type = 'agreement' OR (type = 'template' AND kol_content_post_id IS NULL))
  LOOP
    PERFORM public.sync_threshold_rows_from_payment_terms(r.id);
  END LOOP;

  FOR r IN
    SELECT DISTINCT payment_terms_id AS id
    FROM public.kol_performance_thresholds
    WHERE payment_terms_id IS NOT NULL AND is_achieved = true
  LOOP
    PERFORM public.apply_performance_bonus(r.id);
  END LOOP;
END;
$$;
