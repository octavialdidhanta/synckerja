-- Customer Survey (WhatsApp): settings, invitations, responses; RLS; public RPCs; CRM RPC; enqueue trigger.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_customer_survey_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  sending_method text NOT NULL DEFAULT 'automatic' CHECK (sending_method = 'automatic'),
  promoter_min_rating smallint NOT NULL DEFAULT 4 CHECK (promoter_min_rating >= 1 AND promoter_min_rating <= 5),
  question_text text NOT NULL DEFAULT '',
  scale_min_label text NOT NULL DEFAULT '',
  scale_max_label text NOT NULL DEFAULT '',
  follow_up_mode text NOT NULL DEFAULT 'none' CHECK (follow_up_mode = ANY (ARRAY['none'::text, 'single'::text, 'by_score'::text])),
  follow_up_single text,
  follow_up_low text,
  follow_up_mid text,
  follow_up_high text,
  closing_message text NOT NULL DEFAULT '',
  survey_page_title text NOT NULL DEFAULT '',
  thank_you_message text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.organization_customer_survey_settings IS 'Per-org WhatsApp CES survey copy & follow-up rules; dispatch automatic on WA resolve.';

CREATE TABLE IF NOT EXISTS public.customer_survey_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  whatsapp_conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations (id) ON DELETE CASCADE,
  phone_number_id text,
  assignee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending_send' CHECK (
    status = ANY (
      ARRAY[
        'pending_send'::text,
        'sent'::text,
        'send_failed'::text,
        'submitted'::text,
        'skipped'::text
      ]
    )
  ),
  resolve_marked_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_survey_invitations_one_pending_per_conv
  ON public.customer_survey_invitations (whatsapp_conversation_id)
  WHERE status = 'pending_send';

CREATE INDEX IF NOT EXISTS idx_customer_survey_invitations_org_status
  ON public.customer_survey_invitations (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_survey_invitations_pending_dispatch
  ON public.customer_survey_invitations (created_at)
  WHERE status = 'pending_send';

COMMENT ON TABLE public.customer_survey_invitations IS 'Survey dispatch queue + token; multiple rows per conversation over time (resolve cycles).';

CREATE TABLE IF NOT EXISTS public.customer_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.customer_survey_invitations (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  whatsapp_conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations (id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  follow_up_question_used text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_survey_responses_org_submitted
  ON public.customer_survey_responses (organization_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_survey_responses_assignee
  ON public.customer_survey_responses (organization_id, assignee_id, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_customer_survey_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_survey_invitations_updated_at ON public.customer_survey_invitations;
CREATE TRIGGER trg_customer_survey_invitations_updated_at
  BEFORE UPDATE ON public.customer_survey_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_survey_invitations_updated_at();

CREATE OR REPLACE FUNCTION public.organization_customer_survey_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_customer_survey_settings_updated_at ON public.organization_customer_survey_settings;
CREATE TRIGGER trg_organization_customer_survey_settings_updated_at
  BEFORE UPDATE ON public.organization_customer_survey_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_customer_survey_settings_set_updated_at();

-- True if auth.uid() is org owner (user_roles) or omnichannel roster admin for org.
CREATE OR REPLACE FUNCTION public.is_omnichannel_survey_settings_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_omnichannel_staff s
    INNER JOIN public.employees e ON e.id = s.employee_id AND e.user_id = auth.uid()
    WHERE s.organization_id = p_organization_id
      AND s.role = 'admin'::text
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_omnichannel_survey_settings_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_status_is_resolved_survey(p_lead_status_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses ls
    WHERE ls.id = p_lead_status_id
      AND lower(trim(ls.name)) = ANY (ARRAY['closed'::text, 'resolve'::text])
  );
$$;

-- ---------------------------------------------------------------------------
-- Enqueue invitation when WA conversation moves to Resolved
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_customer_survey_on_wa_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_status_id IS NOT DISTINCT FROM OLD.lead_status_id THEN
    RETURN NEW;
  END IF;

  IF coalesce(lower(trim(NEW.channel::text)), 'whatsapp') <> 'whatsapp' THEN
    RETURN NEW;
  END IF;

  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.lead_status_is_resolved_survey(NEW.lead_status_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.is_enabled, false)
  INTO v_enabled
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_survey_invitations (
    organization_id,
    whatsapp_conversation_id,
    phone_number_id,
    assignee_id,
    status,
    resolve_marked_at
  )
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.phone_number_id,
    NEW.assignee_id,
    'pending_send',
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_enqueue_customer_survey ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_enqueue_customer_survey
  AFTER UPDATE OF lead_status_id ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_customer_survey_on_wa_resolve();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.organization_customer_survey_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_survey_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_customer_survey_settings_select ON public.organization_customer_survey_settings;
CREATE POLICY organization_customer_survey_settings_select
  ON public.organization_customer_survey_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_customer_survey_settings_insert ON public.organization_customer_survey_settings;
CREATE POLICY organization_customer_survey_settings_insert
  ON public.organization_customer_survey_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_customer_survey_settings_update ON public.organization_customer_survey_settings;
CREATE POLICY organization_customer_survey_settings_update
  ON public.organization_customer_survey_settings
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_customer_survey_settings_delete ON public.organization_customer_survey_settings;
CREATE POLICY organization_customer_survey_settings_delete
  ON public.organization_customer_survey_settings
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

-- Invitations: service role only from Edge; block normal API reads
DROP POLICY IF EXISTS customer_survey_invitations_block_authenticated ON public.customer_survey_invitations;
CREATE POLICY customer_survey_invitations_block_authenticated
  ON public.customer_survey_invitations
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS customer_survey_responses_select_org ON public.customer_survey_responses;
CREATE POLICY customer_survey_responses_select_org
  ON public.customer_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = customer_survey_responses.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- Public RPCs (anon): load form + submit
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_customer_survey_form(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.customer_survey_invitations%ROWTYPE;
  v_s public.organization_customer_survey_settings%ROWTYPE;
BEGIN
  SELECT i.* INTO v_inv
  FROM public.customer_survey_invitations i
  WHERE i.public_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_inv.status <> 'sent' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available');
  END IF;

  SELECT s.* INTO v_s
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = v_inv.organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'token', p_token,
    'survey_page_title', coalesce(nullif(trim(v_s.survey_page_title), ''), 'Feedback'),
    'question_text', v_s.question_text,
    'scale_min_label', v_s.scale_min_label,
    'scale_max_label', v_s.scale_max_label,
    'follow_up_mode', v_s.follow_up_mode,
    'follow_up_single', v_s.follow_up_single,
    'follow_up_low', v_s.follow_up_low,
    'follow_up_mid', v_s.follow_up_mid,
    'follow_up_high', v_s.follow_up_high,
    'thank_you_message', v_s.thank_you_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_customer_survey_form(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_customer_survey_form(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_customer_survey_form(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_customer_survey(p_token uuid, p_rating integer, p_comment text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.customer_survey_invitations%ROWTYPE;
  v_follow_q text;
  v_s public.organization_customer_survey_settings%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  SELECT i.* INTO v_inv
  FROM public.customer_survey_invitations i
  WHERE i.public_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_inv.status <> 'sent' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used_or_invalid');
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_survey_responses r WHERE r.invitation_id = v_inv.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  SELECT s.* INTO v_s
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = v_inv.organization_id;

  v_follow_q := NULL;
  IF FOUND THEN
    IF v_s.follow_up_mode = 'single' AND v_s.follow_up_single IS NOT NULL THEN
      v_follow_q := trim(v_s.follow_up_single);
    ELSIF v_s.follow_up_mode = 'by_score' THEN
      IF p_rating <= 2 THEN
        v_follow_q := trim(coalesce(v_s.follow_up_low, ''));
      ELSIF p_rating = 3 THEN
        v_follow_q := trim(coalesce(v_s.follow_up_mid, ''));
      ELSE
        v_follow_q := trim(coalesce(v_s.follow_up_high, ''));
      END IF;
      IF v_follow_q = '' THEN
        v_follow_q := NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.customer_survey_responses (
    invitation_id,
    organization_id,
    whatsapp_conversation_id,
    assignee_id,
    rating,
    comment,
    follow_up_question_used
  )
  VALUES (
    v_inv.id,
    v_inv.organization_id,
    v_inv.whatsapp_conversation_id,
    v_inv.assignee_id,
    p_rating::smallint,
    nullif(trim(coalesce(p_comment, '')), ''),
    v_follow_q
  );

  UPDATE public.customer_survey_invitations
  SET status = 'submitted', updated_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'thank_you_message', coalesce(v_s.thank_you_message, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_customer_survey(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_customer_survey(uuid, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_customer_survey(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- CRM aggregate RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_customer_survey_summary(
  p_organization_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_rating smallint := 4;
  v_total bigint;
  v_promoters bigint;
  v_pct numeric;
  v_counts jsonb;
  v_by_assignee jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(s.promoter_min_rating, 4)
  INTO v_min_rating
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    v_min_rating := 4;
  END IF;

  SELECT count(*)::bigint
  INTO v_total
  FROM public.customer_survey_responses r
  WHERE r.organization_id = p_organization_id
    AND r.submitted_at >= p_from
    AND r.submitted_at < p_to;

  SELECT count(*)::bigint
  INTO v_promoters
  FROM public.customer_survey_responses r
  WHERE r.organization_id = p_organization_id
    AND r.submitted_at >= p_from
    AND r.submitted_at < p_to
    AND r.rating >= v_min_rating;

  v_pct := CASE
    WHEN v_total > 0 THEN round((100.0 * v_promoters / v_total)::numeric, 2)
    ELSE 0::numeric
  END;

  SELECT coalesce(
    jsonb_object_agg(rating::text, c),
    '{}'::jsonb
  )
  INTO v_counts
  FROM (
    SELECT r.rating, count(*)::bigint AS c
    FROM public.customer_survey_responses r
    WHERE r.organization_id = p_organization_id
      AND r.submitted_at >= p_from
      AND r.submitted_at < p_to
    GROUP BY r.rating
  ) q;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_by_assignee
  FROM (
    SELECT
      r.assignee_id,
      coalesce(nullif(trim(e.full_name), ''), e.email, r.assignee_id::text) AS assignee_name,
      count(*)::bigint AS response_count,
      count(*) FILTER (WHERE r.rating >= v_min_rating)::bigint AS promoter_count,
      CASE
        WHEN count(*) > 0 THEN round((100.0 * count(*) FILTER (WHERE r.rating >= v_min_rating) / count(*))::numeric, 2)
        ELSE 0::numeric
      END AS promoter_pct,
      jsonb_build_object(
        '1', count(*) FILTER (WHERE r.rating = 1),
        '2', count(*) FILTER (WHERE r.rating = 2),
        '3', count(*) FILTER (WHERE r.rating = 3),
        '4', count(*) FILTER (WHERE r.rating = 4),
        '5', count(*) FILTER (WHERE r.rating = 5)
      ) AS counts_by_rating
    FROM public.customer_survey_responses r
    LEFT JOIN public.employees e ON e.id = r.assignee_id
    WHERE r.organization_id = p_organization_id
      AND r.submitted_at >= p_from
      AND r.submitted_at < p_to
    GROUP BY r.assignee_id, e.full_name, e.email
    ORDER BY response_count DESC
  ) t;

  RETURN jsonb_build_object(
    'total_responses', v_total,
    'promoter_count', v_promoters,
    'promoter_pct', v_pct,
    'promoter_min_rating', v_min_rating,
    'counts_by_rating', coalesce(v_counts, '{}'::jsonb),
    'by_assignee', coalesce(v_by_assignee, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_customer_survey_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_customer_survey_summary(uuid, timestamptz, timestamptz) TO authenticated;
