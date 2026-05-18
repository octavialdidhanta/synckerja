-- Leads Management: template follow-up cycle state, Set Status FU priority, sync guards.

-- 1) State columns on leads + whatsapp_conversations
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS template_followup_awaiting_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_cycle_reset_at timestamptz NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS template_followup_awaiting_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_cycle_reset_at timestamptz NULL;

COMMENT ON COLUMN public.leads.template_followup_awaiting_reply IS 'True after a successful template follow-up send until customer inbound resets the cycle.';
COMMENT ON COLUMN public.leads.follow_up_cycle_reset_at IS 'Manual follow-up updates before this timestamp are excluded from count/priority.';
COMMENT ON COLUMN public.whatsapp_conversations.template_followup_awaiting_reply IS 'Mirrors leads template follow-up pending state for virtual wa- rows.';
COMMENT ON COLUMN public.whatsapp_conversations.follow_up_cycle_reset_at IS 'Mirrors leads cycle reset for virtual wa- rows.';

-- 2) Allow fu_priority = Set Status on leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_fu_priority_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_fu_priority_check CHECK (
    fu_priority IS NULL
    OR fu_priority = ANY (
      ARRAY['High'::text, 'Medium'::text, 'Low'::text, 'Please Follow Up'::text, 'Set Status'::text]
    )
  );

-- 3) Audit: link template follow-ups to manual leads
ALTER TABLE public.whatsapp_template_followups
  ADD COLUMN IF NOT EXISTS lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_followups_lead
  ON public.whatsapp_template_followups (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

-- 4) Count template sends since cycle reset (sent only)
CREATE OR REPLACE FUNCTION public.count_template_followups_since_reset(
  p_conv_id uuid,
  p_lead_id uuid,
  p_reset_at timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.whatsapp_template_followups wtf
  WHERE wtf.send_status = 'sent'
    AND (
      (p_conv_id IS NOT NULL AND wtf.whatsapp_conversation_id = p_conv_id)
      OR (p_lead_id IS NOT NULL AND wtf.lead_id = p_lead_id)
    )
    AND (p_reset_at IS NULL OR wtf.created_at > p_reset_at);
$$;

-- 5) After successful template send
CREATE OR REPLACE FUNCTION public.apply_template_followup_sent(
  p_lead_id uuid,
  p_conv_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_at timestamptz;
  v_template_cnt integer;
  v_ticket_id text;
BEGIN
  IF p_conv_id IS NULL AND p_lead_id IS NULL THEN
    RETURN;
  END IF;

  IF p_conv_id IS NOT NULL THEN
    SELECT follow_up_cycle_reset_at, ticket_id
    INTO v_reset_at, v_ticket_id
    FROM public.whatsapp_conversations
    WHERE id = p_conv_id;

    v_template_cnt := public.count_template_followups_since_reset(p_conv_id, p_lead_id, v_reset_at);

    UPDATE public.whatsapp_conversations
    SET
      template_followup_awaiting_reply = true,
      followup = v_template_cnt,
      updated_at = NOW()
    WHERE id = p_conv_id;

    IF v_ticket_id IS NOT NULL AND trim(v_ticket_id) <> '' THEN
      UPDATE public.leads l
      SET
        template_followup_awaiting_reply = true,
        followup = v_template_cnt,
        updated_at = NOW()
      WHERE l.ticket_id = trim(v_ticket_id);
    ELSIF p_lead_id IS NOT NULL THEN
      SELECT follow_up_cycle_reset_at INTO v_reset_at FROM public.leads WHERE id = p_lead_id;
      v_template_cnt := public.count_template_followups_since_reset(p_conv_id, p_lead_id, v_reset_at);
      UPDATE public.leads
      SET template_followup_awaiting_reply = true, followup = v_template_cnt, updated_at = NOW()
      WHERE id = p_lead_id;
    END IF;
  ELSIF p_lead_id IS NOT NULL THEN
    SELECT follow_up_cycle_reset_at INTO v_reset_at FROM public.leads WHERE id = p_lead_id;
    v_template_cnt := public.count_template_followups_since_reset(NULL, p_lead_id, v_reset_at);
    UPDATE public.leads
    SET template_followup_awaiting_reply = true, followup = v_template_cnt, updated_at = NOW()
    WHERE id = p_lead_id;
  END IF;
END;
$$;

-- 6) After customer inbound while awaiting template reply
CREATE OR REPLACE FUNCTION public.apply_template_followup_customer_reply(
  p_lead_id uuid,
  p_conv_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id text;
  v_now timestamptz := NOW();
BEGIN
  IF p_conv_id IS NULL AND p_lead_id IS NULL THEN
    RETURN;
  END IF;

  IF p_conv_id IS NOT NULL THEN
    SELECT ticket_id INTO v_ticket_id FROM public.whatsapp_conversations WHERE id = p_conv_id;

    UPDATE public.whatsapp_conversations
    SET
      template_followup_awaiting_reply = false,
      follow_up_cycle_reset_at = v_now,
      followup = 0,
      fu_priority = 'Set Status',
      updated_at = v_now
    WHERE id = p_conv_id
      AND template_followup_awaiting_reply = true;

    IF v_ticket_id IS NOT NULL AND trim(v_ticket_id) <> '' THEN
      UPDATE public.leads
      SET
        template_followup_awaiting_reply = false,
        follow_up_cycle_reset_at = v_now,
        followup = 0,
        fu_priority = 'Set Status',
        updated_at = v_now
      WHERE ticket_id = trim(v_ticket_id)
        AND template_followup_awaiting_reply = true;
    END IF;
  END IF;

  IF p_lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET
      template_followup_awaiting_reply = false,
      follow_up_cycle_reset_at = v_now,
      followup = 0,
      fu_priority = 'Set Status',
      updated_at = v_now
    WHERE id = p_lead_id
      AND template_followup_awaiting_reply = true;
  END IF;
END;
$$;

-- 7) Refactor manual sync: respect cycle reset + template pending + Set Status
CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
  v_awaiting boolean;
  v_reset_at timestamptz;
  v_fu_priority text;
BEGIN
  IF p_conv_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(template_followup_awaiting_reply, false),
    follow_up_cycle_reset_at,
    fu_priority
  INTO v_awaiting, v_reset_at, v_fu_priority
  FROM public.whatsapp_conversations
  WHERE id = p_conv_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_awaiting THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM public.lead_follow_up_updates
  WHERE conversation_id = p_conv_id
    AND (v_reset_at IS NULL OR created_at > v_reset_at);

  IF total_cnt = 0 THEN
    IF v_fu_priority = 'Set Status' THEN
      RETURN;
    END IF;
    fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt)
    AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt)
    AND hot_cnt > 0 THEN
    fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt)
    AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt)
    AND warm_cnt > 0 THEN
    fp := 'Medium';
  ELSIF cold_cnt > 0 THEN
    fp := 'Low';
  ELSE
    fp := NULL;
  END IF;

  UPDATE public.whatsapp_conversations
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_conv_id;

  UPDATE public.leads l
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  FROM public.whatsapp_conversations c
  WHERE c.id = p_conv_id
    AND l.ticket_id IS NOT NULL
    AND trim(l.ticket_id) <> ''
    AND l.ticket_id = c.ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
  v_awaiting boolean;
  v_reset_at timestamptz;
  v_fu_priority text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(template_followup_awaiting_reply, false),
    follow_up_cycle_reset_at,
    fu_priority
  INTO v_awaiting, v_reset_at, v_fu_priority
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_awaiting THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM public.lead_follow_up_updates
  WHERE lead_id = p_lead_id
    AND (v_reset_at IS NULL OR created_at > v_reset_at);

  IF total_cnt = 0 THEN
    IF v_fu_priority = 'Set Status' THEN
      RETURN;
    END IF;
    fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt)
    AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt)
    AND hot_cnt > 0 THEN
    fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt)
    AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt)
    AND warm_cnt > 0 THEN
    fp := 'Medium';
  ELSIF cold_cnt > 0 THEN
    fp := 'Low';
  ELSE
    fp := NULL;
  END IF;

  UPDATE public.leads
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;
