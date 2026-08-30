-- POS checkout lead guards: keep ads/Lead Magnet attribution intact, block
-- duplicate POS inserts for an existing phone, and refuse generic name overwrite.
-- No UNIQUE on phone_number (variants 0812 / 62812 may already coexist).

CREATE INDEX IF NOT EXISTS idx_leads_org_phone_number
  ON public.leads (organization_id, phone_number)
  WHERE phone_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_generic_customer_name(p_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  n text;
BEGIN
  n := lower(btrim(COALESCE(p_name, '')));
  IF n = '' OR n = 'walk-in' OR n = 'walk in' THEN
    RETURN true;
  END IF;
  IF btrim(COALESCE(p_name, '')) IN ('—', '-') THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_generic_customer_name(text) IS
  'True for empty / Walk-in / dash placeholders. Aligns with app isGenericCustomerName.';

CREATE OR REPLACE FUNCTION public.leads_guard_pos_checkout_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF upper(btrim(COALESCE(NEW.source, ''))) <> 'POS' THEN
    RETURN NEW;
  END IF;
  v_key := public.normalize_wa_phone_key(NEW.phone_number);
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.leads AS e
    WHERE e.organization_id = NEW.organization_id
      AND e.phone_number IS NOT NULL
      AND public.normalize_wa_phone_key(e.phone_number) = v_key
  ) THEN
    RAISE EXCEPTION 'pos_checkout_phone_exists'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_guard_pos_checkout_insert ON public.leads;
CREATE TRIGGER trg_leads_guard_pos_checkout_insert
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_guard_pos_checkout_insert();

CREATE OR REPLACE FUNCTION public.leads_guard_pos_checkout_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_old_source text;
  v_new_source text;
BEGIN
  v_old_source := btrim(COALESCE(OLD.source, ''));
  v_new_source := btrim(COALESCE(NEW.source, ''));
  IF v_old_source <> '' AND upper(v_new_source) = 'POS' AND upper(v_old_source) <> 'POS' THEN
    NEW.source := OLD.source;
  END IF;

  IF OLD.attribution IS NOT NULL THEN
    NEW.attribution := OLD.attribution;
  END IF;
  IF OLD.attribution_label IS NOT NULL AND btrim(OLD.attribution_label) <> '' THEN
    NEW.attribution_label := OLD.attribution_label;
  END IF;
  IF OLD.ticket_id IS NOT NULL AND btrim(OLD.ticket_id) <> '' THEN
    NEW.ticket_id := OLD.ticket_id;
  END IF;

  IF NOT public.is_generic_customer_name(OLD.client)
     AND public.is_generic_customer_name(NEW.client) THEN
    NEW.client := OLD.client;
  END IF;

  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    v_key := public.normalize_wa_phone_key(NEW.phone_number);
    IF v_key IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.leads AS e
      WHERE e.organization_id = NEW.organization_id
        AND e.id IS DISTINCT FROM NEW.id
        AND e.phone_number IS NOT NULL
        AND public.normalize_wa_phone_key(e.phone_number) = v_key
    ) THEN
      RAISE EXCEPTION 'pos_checkout_phone_exists'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_guard_pos_checkout_update ON public.leads;
CREATE TRIGGER trg_leads_guard_pos_checkout_update
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_guard_pos_checkout_update();

COMMENT ON FUNCTION public.leads_guard_pos_checkout_insert() IS
  'Reject POS lead insert when the phone already belongs to another org lead.';
COMMENT ON FUNCTION public.leads_guard_pos_checkout_update() IS
  'Keep source/attribution/ticket; block Walk-in overwrite of a personal name; reject phone collisions.';
