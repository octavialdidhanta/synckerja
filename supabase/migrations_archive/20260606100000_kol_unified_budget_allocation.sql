-- Unified budget allocation: accumulate amounts per campaign+KOL (fixes multi-post under-count)

CREATE OR REPLACE FUNCTION public.upsert_kol_budget_allocation(
  p_campaign_id uuid,
  p_kol_profile_id uuid,
  p_organization_id uuid,
  p_amount_delta numeric,
  p_payment_model text DEFAULT 'fixed',
  p_payment_terms_id uuid DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_budget_type text;
  v_delta numeric(15, 2);
BEGIN
  IF p_campaign_id IS NULL OR p_kol_profile_id IS NULL OR p_organization_id IS NULL THEN
    RETURN;
  END IF;

  v_delta := COALESCE(p_amount_delta, 0);
  IF v_delta <= 0 THEN
    RETURN;
  END IF;

  v_budget_type := CASE COALESCE(p_payment_model, 'fixed')
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
    p_campaign_id,
    p_kol_profile_id,
    p_organization_id,
    v_delta,
    v_delta,
    COALESCE(p_payment_model, 'fixed'),
    v_budget_type,
    p_payment_terms_id
  )
  ON CONFLICT (campaign_id, kol_profile_id) DO UPDATE SET
    allocated_budget = public.kol_campaign_budget_allocations.allocated_budget + EXCLUDED.allocated_budget,
    base_budget = public.kol_campaign_budget_allocations.base_budget + EXCLUDED.base_budget,
    payment_terms_id = COALESCE(EXCLUDED.payment_terms_id, public.kol_campaign_budget_allocations.payment_terms_id),
    payment_model = EXCLUDED.payment_model,
    budget_type = EXCLUDED.budget_type,
    updated_at = timezone('utc'::text, now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_budget_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_amount numeric(15, 2) := 0;
  v_payment_model text := 'fixed';
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

  PERFORM public.upsert_kol_budget_allocation(
    NEW.campaign_id,
    NEW.kol_profile_id,
    NEW.organization_id,
    COALESCE(v_base_amount, 0),
    v_payment_model,
    v_payment_terms_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_budget_allocation_from_payment_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_post public.kol_content_posts%ROWTYPE;
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

  PERFORM public.upsert_kol_budget_allocation(
    NEW.campaign_id,
    NEW.kol_profile_id,
    v_post.organization_id,
    COALESCE(NEW.base_amount, 0),
    COALESCE(NEW.payment_model, 'fixed'),
    NEW.id
  );

  RETURN NEW;
END;
$function$;

-- Backfill: recalculate allocated_budget from sum of agreement base_amounts per campaign+KOL
UPDATE public.kol_campaign_budget_allocations kba
SET
  allocated_budget = sub.total_base,
  base_budget = sub.total_base,
  updated_at = timezone('utc'::text, now())
FROM (
  SELECT
    campaign_id,
    kol_profile_id,
    SUM(COALESCE(base_amount, 0)) AS total_base
  FROM public.kol_payment_terms
  WHERE type = 'agreement'
    AND campaign_id IS NOT NULL
    AND kol_profile_id IS NOT NULL
  GROUP BY campaign_id, kol_profile_id
) sub
WHERE kba.campaign_id = sub.campaign_id
  AND kba.kol_profile_id = sub.kol_profile_id
  AND kba.allocated_budget IS DISTINCT FROM sub.total_base;
