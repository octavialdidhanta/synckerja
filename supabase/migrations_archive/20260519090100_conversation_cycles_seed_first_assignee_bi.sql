-- When a new conversation cycle row is inserted, assignee_id on the parent conversation may
-- already be set (re-open after resolve without assignee change). The AFTER UPDATE trigger on
-- conversations then does not fire, leaving first_assignee_in_cycle_at NULL and forcing
-- get_crm_first_response_time_per_room first-reply SLA to 'pending' despite first_response_at.
--
-- BEFORE INSERT: if cycle.first_assignee_in_cycle_at is still null and the parent conversation
-- has an assignee, anchor SLA to cycle_started_at (same semantics as historical backfill in
-- 20260516120000_omnichannel_sla_tables_cycle_anchor.sql).

CREATE OR REPLACE FUNCTION public.whatsapp_conversation_cycles_bi_seed_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_assignee_in_cycle_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = NEW.conversation_id
      AND c.assignee_id IS NOT NULL
  ) THEN
    NEW.first_assignee_in_cycle_at := NEW.cycle_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversation_cycles_bi_seed_first_assignee
  ON public.whatsapp_conversation_cycles;
CREATE TRIGGER trg_whatsapp_conversation_cycles_bi_seed_first_assignee
  BEFORE INSERT ON public.whatsapp_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_conversation_cycles_bi_seed_first_assignee();

CREATE OR REPLACE FUNCTION public.instagram_conversation_cycles_bi_seed_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_assignee_in_cycle_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.instagram_conversations c
    WHERE c.id = NEW.conversation_id
      AND c.assignee_id IS NOT NULL
  ) THEN
    NEW.first_assignee_in_cycle_at := NEW.cycle_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instagram_conversation_cycles_bi_seed_first_assignee
  ON public.instagram_conversation_cycles;
CREATE TRIGGER trg_instagram_conversation_cycles_bi_seed_first_assignee
  BEFORE INSERT ON public.instagram_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.instagram_conversation_cycles_bi_seed_first_assignee();

CREATE OR REPLACE FUNCTION public.email_conversation_cycles_bi_seed_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_assignee_in_cycle_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.email_conversations c
    WHERE c.id = NEW.conversation_id
      AND c.assignee_id IS NOT NULL
  ) THEN
    NEW.first_assignee_in_cycle_at := NEW.cycle_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_conversation_cycles_bi_seed_first_assignee
  ON public.email_conversation_cycles;
CREATE TRIGGER trg_email_conversation_cycles_bi_seed_first_assignee
  BEFORE INSERT ON public.email_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.email_conversation_cycles_bi_seed_first_assignee();

-- One-time repair: cycles that already missed the anchor (same condition as legacy backfill).
UPDATE public.whatsapp_conversation_cycles cy
SET
  first_assignee_in_cycle_at = cy.cycle_started_at,
  updated_at = now()
WHERE cy.first_assignee_in_cycle_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = cy.conversation_id
      AND c.assignee_id IS NOT NULL
  );

UPDATE public.instagram_conversation_cycles cy
SET
  first_assignee_in_cycle_at = cy.cycle_started_at,
  updated_at = now()
WHERE cy.first_assignee_in_cycle_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.instagram_conversations c
    WHERE c.id = cy.conversation_id
      AND c.assignee_id IS NOT NULL
  );

UPDATE public.email_conversation_cycles cy
SET
  first_assignee_in_cycle_at = cy.cycle_started_at,
  updated_at = now()
WHERE cy.first_assignee_in_cycle_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.email_conversations c
    WHERE c.id = cy.conversation_id
      AND c.assignee_id IS NOT NULL
  );

COMMENT ON FUNCTION public.whatsapp_conversation_cycles_bi_seed_first_assignee() IS
  'BEFORE INSERT on whatsapp_conversation_cycles: sets first_assignee_in_cycle_at from cycle_started_at when parent conversation already has assignee_id.';
COMMENT ON FUNCTION public.instagram_conversation_cycles_bi_seed_first_assignee() IS
  'BEFORE INSERT on instagram_conversation_cycles: sets first_assignee_in_cycle_at from cycle_started_at when parent conversation already has assignee_id.';
COMMENT ON FUNCTION public.email_conversation_cycles_bi_seed_first_assignee() IS
  'BEFORE INSERT on email_conversation_cycles: sets first_assignee_in_cycle_at from cycle_started_at when parent conversation already has assignee_id.';
