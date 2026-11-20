-- auto_create_budget_allocation: upsert budget row when a content post is created
CREATE OR REPLACE FUNCTION public.auto_create_budget_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_amount numeric(15, 2) := 0;
  v_payment_model text := 'fixed';
  v_budget_type text := 'fixed';
  v_payment_terms_id uuid;
BEGIN
  IF NEW.campaign_id IS NULL OR NEW.kol_profile_id IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kpt.id, COALESCE(kpt.base_amount, 0), COALESCE(kpt.payment_model, 'fixed')
  INTO v_payment_terms_id, v_base_amount, v_payment_model
  FROM public.kol_payment_terms kpt
  WHERE kpt.kol_content_post_id = NEW.id
  LIMIT 1;

  IF v_base_amount <= 0 AND NEW.campaign_deliverable_id IS NOT NULL THEN
    SELECT COALESCE(kcd.total_price, kcd.price_per_deliverable, 0)
    INTO v_base_amount
    FROM public.kol_campaign_deliverables kcd
    WHERE kcd.id = NEW.campaign_deliverable_id;
  END IF;

  v_base_amount := COALESCE(v_base_amount, 0);

  v_budget_type := CASE v_payment_model
    WHEN 'performance_based' THEN 'performance'
    WHEN 'barter_plus_fee' THEN 'hybrid'
    ELSE 'fixed'
  END;

  INSERT INTO public.kol_campaign_budget_allocations (
    campaign_id,
    kol_profile_id,
    organization_id,
    allocated_budget,
    base_budget,
    payment_model,
    budget_type,
    payment_terms_id
  )
  VALUES (
    NEW.campaign_id,
    NEW.kol_profile_id,
    NEW.organization_id,
    v_base_amount,
    v_base_amount,
    v_payment_model,
    v_budget_type,
    v_payment_terms_id
  )
  ON CONFLICT (campaign_id, kol_profile_id) DO UPDATE SET
    allocated_budget = public.kol_campaign_budget_allocations.allocated_budget + EXCLUDED.allocated_budget,
    base_budget = public.kol_campaign_budget_allocations.base_budget + EXCLUDED.base_budget,
    payment_terms_id = COALESCE(EXCLUDED.payment_terms_id, public.kol_campaign_budget_allocations.payment_terms_id),
    payment_model = EXCLUDED.payment_model,
    budget_type = EXCLUDED.budget_type,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$function$;

-- update_campaign_budget_totals: rollup allocated/remaining budget on kol_campaigns
CREATE OR REPLACE FUNCTION public.update_campaign_budget_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id uuid;
  v_total_allocated numeric(15, 2);
  v_campaign_budget numeric(15, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_campaign_id := OLD.campaign_id;
  ELSE
    v_campaign_id := NEW.campaign_id;
  END IF;

  SELECT COALESCE(SUM(allocated_budget), 0)
  INTO v_total_allocated
  FROM public.kol_campaign_budget_allocations
  WHERE campaign_id = v_campaign_id;

  SELECT COALESCE(total_budget, budget, 0)
  INTO v_campaign_budget
  FROM public.kol_campaigns
  WHERE id = v_campaign_id;

  UPDATE public.kol_campaigns
  SET
    allocated_budget = v_total_allocated,
    remaining_budget = GREATEST(v_campaign_budget - v_total_allocated, 0),
    updated_at = timezone('utc'::text, now())
  WHERE id = v_campaign_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- sync_performance_thresholds_from_metrics: push metric values into threshold rows
CREATE OR REPLACE FUNCTION public.sync_performance_thresholds_from_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_engagement numeric;
  v_conversion_count numeric;
BEGIN
  v_engagement := CASE
    WHEN COALESCE(NEW.impressions, 0) > 0 AND COALESCE(NEW.engagement_rate, 0) > 0
      THEN (NEW.impressions::numeric * NEW.engagement_rate::numeric) / 100
    ELSE COALESCE(NEW.likes, 0) + COALESCE(NEW.comments, 0) + COALESCE(NEW.shares, 0)
  END;

  SELECT COUNT(*)::numeric
  INTO v_conversion_count
  FROM public.kol_conversions
  WHERE content_post_id = NEW.content_post_id;

  UPDATE public.kol_performance_thresholds
  SET current_value = COALESCE(NEW.reach, 0), updated_at = timezone('utc'::text, now())
  WHERE kol_content_post_id = NEW.content_post_id AND metric_type = 'reach' AND is_active IS NOT FALSE;

  UPDATE public.kol_performance_thresholds
  SET current_value = v_engagement, updated_at = timezone('utc'::text, now())
  WHERE kol_content_post_id = NEW.content_post_id AND metric_type = 'engagement' AND is_active IS NOT FALSE;

  UPDATE public.kol_performance_thresholds
  SET current_value = v_conversion_count, updated_at = timezone('utc'::text, now())
  WHERE kol_content_post_id = NEW.content_post_id AND metric_type = 'conversion' AND is_active IS NOT FALSE;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_performance_thresholds_from_metrics_trigger ON public.kol_performance_metrics;
CREATE TRIGGER sync_performance_thresholds_from_metrics_trigger
  AFTER INSERT OR UPDATE ON public.kol_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_performance_thresholds_from_metrics();

-- Extend achievement check to INSERT as well as UPDATE
DROP TRIGGER IF EXISTS check_threshold_achievement_trigger ON public.kol_performance_thresholds;
CREATE TRIGGER check_threshold_achievement_trigger
  BEFORE INSERT OR UPDATE ON public.kol_performance_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.check_threshold_achievement();

-- Payment terms are inserted after content post; sync budget allocation when they land
CREATE OR REPLACE FUNCTION public.sync_budget_allocation_from_payment_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_post public.kol_content_posts%ROWTYPE;
  v_budget_type text;
  v_base_amount numeric(15, 2);
BEGIN
  IF NEW.kol_content_post_id IS NULL OR NEW.campaign_id IS NULL OR NEW.kol_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_post
  FROM public.kol_content_posts
  WHERE id = NEW.kol_content_post_id;

  IF NOT FOUND OR v_post.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_base_amount := COALESCE(NEW.base_amount, 0);
  v_budget_type := CASE COALESCE(NEW.payment_model, 'fixed')
    WHEN 'performance_based' THEN 'performance'
    WHEN 'barter_plus_fee' THEN 'hybrid'
    ELSE 'fixed'
  END;

  INSERT INTO public.kol_campaign_budget_allocations (
    campaign_id,
    kol_profile_id,
    organization_id,
    allocated_budget,
    base_budget,
    payment_model,
    budget_type,
    payment_terms_id
  )
  VALUES (
    NEW.campaign_id,
    NEW.kol_profile_id,
    v_post.organization_id,
    v_base_amount,
    v_base_amount,
    COALESCE(NEW.payment_model, 'fixed'),
    v_budget_type,
    NEW.id
  )
  ON CONFLICT (campaign_id, kol_profile_id) DO UPDATE SET
    allocated_budget = GREATEST(public.kol_campaign_budget_allocations.allocated_budget, EXCLUDED.allocated_budget),
    base_budget = GREATEST(public.kol_campaign_budget_allocations.base_budget, EXCLUDED.base_budget),
    payment_terms_id = EXCLUDED.payment_terms_id,
    payment_model = EXCLUDED.payment_model,
    budget_type = EXCLUDED.budget_type,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_budget_allocation_from_payment_terms_trigger ON public.kol_payment_terms;
CREATE TRIGGER sync_budget_allocation_from_payment_terms_trigger
  AFTER INSERT OR UPDATE OF base_amount, payment_model, kol_content_post_id ON public.kol_payment_terms
  FOR EACH ROW
  WHEN (NEW.type = 'agreement' AND NEW.kol_content_post_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_budget_allocation_from_payment_terms();
