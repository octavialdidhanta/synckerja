-- Milestone dedup, suppress per-row sync during bulk insert, narrow trigger scope

CREATE OR REPLACE FUNCTION public.sync_payment_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  elem jsonb;
  ord integer := 1;
BEGIN
  IF tg_op = 'UPDATE' AND NEW.milestones IS NOT DISTINCT FROM OLD.milestones THEN
    RETURN NEW;
  END IF;

  IF NEW.milestones IS NULL
     OR jsonb_typeof(NEW.milestones) <> 'array'
     OR jsonb_array_length(NEW.milestones) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('kol.suppress_milestone_status_sync', 'on', true);

  DELETE FROM public.payment_milestones
  WHERE payment_terms_id = NEW.id;

  FOR elem IN SELECT value FROM jsonb_array_elements(NEW.milestones) AS t(value)
  LOOP
    INSERT INTO public.payment_milestones (
      payment_terms_id,
      milestone_name,
      milestone_order,
      percentage,
      amount,
      due_date,
      milestone_description,
      status,
      trigger_condition
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(elem->>'name'), ''), NULLIF(trim(elem->>'milestone_name'), ''), 'Milestone'),
      COALESCE(NULLIF(elem->>'milestone_order', '')::integer, ord),
      COALESCE(NULLIF(elem->>'percentage', '')::numeric, 0),
      COALESCE(NULLIF(elem->>'amount', '')::numeric, 0),
      CASE
        WHEN NULLIF(trim(elem->>'due_date'), '') IS NULL THEN NULL
        ELSE NULLIF(trim(elem->>'due_date'), '')::date
      END,
      NULLIF(trim(elem->>'description'), ''),
      COALESCE(NULLIF(trim(elem->>'status'), ''), 'pending'),
      COALESCE(NULLIF(trim(elem->>'trigger_condition'), ''), 'manual')
    );
    ord := ord + 1;
  END LOOP;

  PERFORM set_config('kol.suppress_milestone_status_sync', 'off', true);
  PERFORM public.sync_payment_status_from_milestones(NEW.id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_payment_status_from_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('kol.suppress_milestone_status_sync', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_payment_status_from_milestones(OLD.payment_terms_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT'
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    PERFORM public.sync_payment_status_from_milestones(NEW.payment_terms_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_payment_milestones_trigger ON public.kol_payment_terms;
CREATE TRIGGER sync_payment_milestones_trigger
  AFTER INSERT OR UPDATE OF milestones ON public.kol_payment_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payment_milestones();

-- Dedup existing milestone rows before unique index
DELETE FROM public.payment_milestones pm
USING (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_terms_id, milestone_order
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.payment_milestones
) d
WHERE pm.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_milestones_terms_order
  ON public.payment_milestones (payment_terms_id, milestone_order);
