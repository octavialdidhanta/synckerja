-- Auto bonus when metrics/conversion update threshold current_value (not only explicit is_achieved UPDATE)

CREATE OR REPLACE FUNCTION public.sync_performance_thresholds_from_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_engagement numeric;
  v_conversion_count numeric;
  r record;
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

  FOR r IN
    SELECT DISTINCT payment_terms_id AS id
    FROM public.kol_performance_thresholds
    WHERE kol_content_post_id = NEW.content_post_id AND payment_terms_id IS NOT NULL
  LOOP
    PERFORM public.apply_performance_bonus(r.id);
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_conversion_thresholds_from_conversions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_post_id uuid;
  v_count numeric;
  r record;
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

  FOR r IN
    SELECT DISTINCT payment_terms_id AS id
    FROM public.kol_performance_thresholds
    WHERE kol_content_post_id = v_post_id AND payment_terms_id IS NOT NULL
  LOOP
    PERFORM public.apply_performance_bonus(r.id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_apply_performance_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_achieved = true
    AND (TG_OP = 'INSERT' OR OLD.is_achieved IS DISTINCT FROM NEW.is_achieved OR OLD.current_value IS DISTINCT FROM NEW.current_value) THEN
    IF NEW.payment_terms_id IS NOT NULL THEN
      PERFORM public.apply_performance_bonus(NEW.payment_terms_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS apply_performance_bonus_trigger ON public.kol_performance_thresholds;
CREATE TRIGGER apply_performance_bonus_trigger
  AFTER INSERT OR UPDATE ON public.kol_performance_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_apply_performance_bonus();
