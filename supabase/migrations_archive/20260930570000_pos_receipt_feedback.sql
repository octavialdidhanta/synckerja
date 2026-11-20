-- POS receipt feedback: invitations, responses, public + admin RPCs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pos_receipt_feedback_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  pos_outlet_id uuid REFERENCES public.pos_outlets (id) ON DELETE SET NULL,
  served_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_email text,
  customer_phone text,
  customer_name text,
  share_via_email boolean NOT NULL DEFAULT false,
  share_via_sms boolean NOT NULL DEFAULT false,
  email_status text NOT NULL DEFAULT 'pending_send' CHECK (
    email_status = ANY (ARRAY['pending_send'::text, 'sent'::text, 'send_failed'::text, 'skipped'::text])
  ),
  sms_status text NOT NULL DEFAULT 'pending_send' CHECK (
    sms_status = ANY (ARRAY['pending_send'::text, 'sent'::text, 'send_failed'::text, 'skipped'::text])
  ),
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_receipt_feedback_invitations_sales_activity_unique UNIQUE (sales_activity_id),
  CONSTRAINT pos_receipt_feedback_invitations_token_unique UNIQUE (public_token)
);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_invitations_org
  ON public.pos_receipt_feedback_invitations (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_invitations_pending_email
  ON public.pos_receipt_feedback_invitations (created_at)
  WHERE email_status = 'pending_send' AND share_via_email = true;

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_invitations_pending_sms
  ON public.pos_receipt_feedback_invitations (created_at)
  WHERE sms_status = 'pending_send' AND share_via_sms = true;

COMMENT ON TABLE public.pos_receipt_feedback_invitations IS
  'Digital receipt share + feedback token per store checkout sales activity.';

CREATE TABLE IF NOT EXISTS public.pos_receipt_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.pos_receipt_feedback_invitations (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  pos_outlet_id uuid REFERENCES public.pos_outlets (id) ON DELETE SET NULL,
  served_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  reply_text text,
  replied_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  replied_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_receipt_feedback_responses_invitation_unique UNIQUE (invitation_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_responses_org_submitted
  ON public.pos_receipt_feedback_responses (organization_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_responses_org_outlet
  ON public.pos_receipt_feedback_responses (organization_id, pos_outlet_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_responses_org_employee
  ON public.pos_receipt_feedback_responses (organization_id, served_by_employee_id, submitted_at DESC);

COMMENT ON TABLE public.pos_receipt_feedback_responses IS
  'Customer ratings (1–5) and optional staff replies for POS receipt feedback.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_receipt_feedback_sentiment(p_rating smallint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_rating >= 4 THEN 'good'
    WHEN p_rating <= 3 THEN 'bad'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_pos_receipt_feedback_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_receipt_feedback_invitations_updated_at
  ON public.pos_receipt_feedback_invitations;
CREATE TRIGGER trg_pos_receipt_feedback_invitations_updated_at
  BEFORE UPDATE ON public.pos_receipt_feedback_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_pos_receipt_feedback_invitations_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.pos_receipt_feedback_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_receipt_feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_receipt_feedback_invitations_block_authenticated
  ON public.pos_receipt_feedback_invitations;
CREATE POLICY pos_receipt_feedback_invitations_block_authenticated
  ON public.pos_receipt_feedback_invitations
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS pos_receipt_feedback_responses_select_org
  ON public.pos_receipt_feedback_responses;
CREATE POLICY pos_receipt_feedback_responses_select_org
  ON public.pos_receipt_feedback_responses
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS pos_receipt_feedback_responses_update_reply
  ON public.pos_receipt_feedback_responses;
CREATE POLICY pos_receipt_feedback_responses_update_reply
  ON public.pos_receipt_feedback_responses
  FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Enqueue invitation (checkout)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_pos_receipt_feedback_invitation(
  p_organization_id uuid,
  p_sales_activity_id uuid,
  p_pos_outlet_id uuid,
  p_served_by_employee_id uuid,
  p_customer_email text,
  p_customer_phone text,
  p_customer_name text,
  p_share_via_email boolean,
  p_share_via_sms boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_customer_phone, '')), '');
  v_email_status text := 'skipped';
  v_sms_status text := 'skipped';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_organization_id IS NULL OR p_sales_activity_id IS NULL THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_activities sa
    WHERE sa.id = p_sales_activity_id
      AND sa.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'sales_activity_not_found';
  END IF;

  IF p_share_via_email AND v_email IS NOT NULL THEN
    v_email_status := 'pending_send';
  END IF;

  IF p_share_via_sms AND v_phone IS NOT NULL THEN
    v_sms_status := 'pending_send';
  END IF;

  INSERT INTO public.pos_receipt_feedback_invitations (
    organization_id,
    sales_activity_id,
    pos_outlet_id,
    served_by_employee_id,
    customer_email,
    customer_phone,
    customer_name,
    share_via_email,
    share_via_sms,
    email_status,
    sms_status
  )
  VALUES (
    p_organization_id,
    p_sales_activity_id,
    p_pos_outlet_id,
    p_served_by_employee_id,
    v_email,
    v_phone,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    COALESCE(p_share_via_email, false),
    COALESCE(p_share_via_sms, false),
    v_email_status,
    v_sms_status
  )
  ON CONFLICT (sales_activity_id) DO UPDATE SET
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_pos_receipt_feedback_invitation(
  uuid, uuid, uuid, uuid, text, text, text, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_pos_receipt_feedback_invitation(
  uuid, uuid, uuid, uuid, text, text, text, boolean, boolean
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_pos_receipt_feedback(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.pos_receipt_feedback_invitations%ROWTYPE;
  v_sa public.sales_activities%ROWTYPE;
  v_outlet public.pos_outlets%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_resp public.pos_receipt_feedback_responses%ROWTYPE;
  v_items jsonb;
  v_receipt_settings public.pos_outlet_receipt_settings%ROWTYPE;
  v_already_submitted boolean := false;
BEGIN
  SELECT i.* INTO v_inv
  FROM public.pos_receipt_feedback_invitations i
  WHERE i.public_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT sa.* INTO v_sa
  FROM public.sales_activities sa
  WHERE sa.id = v_inv.sales_activity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_inv.pos_outlet_id IS NOT NULL THEN
    SELECT o.* INTO v_outlet
    FROM public.pos_outlets o
    WHERE o.id = v_inv.pos_outlet_id;
  END IF;

  SELECT o.* INTO v_org
  FROM public.organizations o
  WHERE o.id = v_inv.organization_id
  LIMIT 1;

  IF v_inv.pos_outlet_id IS NOT NULL THEN
    SELECT rs.* INTO v_receipt_settings
    FROM public.pos_outlet_receipt_settings rs
    WHERE rs.outlet_id = v_inv.pos_outlet_id
    LIMIT 1;
  END IF;

  SELECT r.* INTO v_resp
  FROM public.pos_receipt_feedback_responses r
  WHERE r.invitation_id = v_inv.id
  LIMIT 1;

  v_already_submitted := FOUND;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'service_name', i.service_name,
        'sub_service_name', i.sub_service_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'total_price', i.total_price
      )
      ORDER BY i.created_at
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.sales_activity_items i
  WHERE i.sales_activity_id = v_sa.id;

  RETURN jsonb_build_object(
    'ok', true,
    'token', p_token,
    'already_submitted', v_already_submitted,
    'rating', v_resp.rating,
    'comment', v_resp.comment,
    'reply_text', v_resp.reply_text,
    'business_name', COALESCE(nullif(trim(v_outlet.name), ''), nullif(trim(v_org.company_name), ''), 'Store'),
    'outlet_name', COALESCE(nullif(trim(v_outlet.name), ''), ''),
    'customer_name', COALESCE(nullif(trim(v_inv.customer_name), ''), nullif(trim(v_sa.client_name), ''), ''),
    'footer_notes', COALESCE(v_receipt_settings.footer_notes, ''),
    'transaction', jsonb_build_object(
      'receipt_number', left(replace(v_sa.id::text, '-', ''), 7),
      'date', v_sa.date,
      'created_at', v_sa.created_at,
      'total_amount', v_sa.total_amount,
      'checkout_subtotal', v_sa.checkout_subtotal,
      'checkout_tax_amount', v_sa.checkout_tax_amount,
      'checkout_gratuity_amount', v_sa.checkout_gratuity_amount,
      'payment_method', v_sa.payment_method,
      'payment_reference', v_sa.payment_reference,
      'cash_tendered', v_sa.cash_tendered,
      'table_number', v_sa.table_number,
      'items', v_items
    ),
    'thank_you_message', 'Thank you for your feedback!'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_pos_receipt_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_pos_receipt_feedback(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_pos_receipt_feedback(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_pos_receipt_feedback(
  p_token uuid,
  p_rating integer,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.pos_receipt_feedback_invitations%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  SELECT i.* INTO v_inv
  FROM public.pos_receipt_feedback_invitations i
  WHERE i.public_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pos_receipt_feedback_responses r WHERE r.invitation_id = v_inv.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  INSERT INTO public.pos_receipt_feedback_responses (
    invitation_id,
    organization_id,
    sales_activity_id,
    pos_outlet_id,
    served_by_employee_id,
    rating,
    comment
  )
  VALUES (
    v_inv.id,
    v_inv.organization_id,
    v_inv.sales_activity_id,
    v_inv.pos_outlet_id,
    v_inv.served_by_employee_id,
    p_rating::smallint,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  RETURN jsonb_build_object('ok', true, 'thank_you_message', 'Thank you for your feedback!');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_pos_receipt_feedback(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_sentiment text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_good bigint;
  v_bad bigint;
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

  SELECT count(*) FILTER (WHERE public.pos_receipt_feedback_sentiment(r.rating) = 'good'),
         count(*) FILTER (WHERE public.pos_receipt_feedback_sentiment(r.rating) = 'bad')
  INTO v_good, v_bad
  FROM public.pos_receipt_feedback_responses r
  WHERE r.organization_id = p_organization_id
    AND (p_outlet_id IS NULL OR r.pos_outlet_id = p_outlet_id)
    AND (p_employee_id IS NULL OR r.served_by_employee_id = p_employee_id)
    AND (p_sentiment IS NULL OR public.pos_receipt_feedback_sentiment(r.rating) = p_sentiment)
    AND (p_from IS NULL OR r.submitted_at::date >= p_from)
    AND (p_to IS NULL OR r.submitted_at::date <= p_to);

  SELECT COALESCE(
    jsonb_agg(row_to_json(t)::jsonb ORDER BY t.submitted_at DESC),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      r.id,
      r.invitation_id,
      r.sales_activity_id,
      r.pos_outlet_id,
      r.served_by_employee_id,
      r.rating,
      public.pos_receipt_feedback_sentiment(r.rating) AS sentiment,
      r.comment,
      r.reply_text,
      r.replied_by,
      r.replied_at,
      r.submitted_at,
      COALESCE(nullif(trim(v_inv.customer_name), ''), nullif(trim(sa.client_name), ''), '—') AS customer_name,
      COALESCE(nullif(trim(po.name), ''), '—') AS outlet_name,
      COALESCE(nullif(trim(e.full_name), ''), '—') AS employee_name
    FROM public.pos_receipt_feedback_responses r
    JOIN public.pos_receipt_feedback_invitations v_inv ON v_inv.id = r.invitation_id
    LEFT JOIN public.sales_activities sa ON sa.id = r.sales_activity_id
    LEFT JOIN public.pos_outlets po ON po.id = r.pos_outlet_id
    LEFT JOIN public.employees e ON e.id = r.served_by_employee_id
    WHERE r.organization_id = p_organization_id
      AND (p_outlet_id IS NULL OR r.pos_outlet_id = p_outlet_id)
      AND (p_employee_id IS NULL OR r.served_by_employee_id = p_employee_id)
      AND (p_sentiment IS NULL OR public.pos_receipt_feedback_sentiment(r.rating) = p_sentiment)
      AND (p_from IS NULL OR r.submitted_at::date >= p_from)
      AND (p_to IS NULL OR r.submitted_at::date <= p_to)
    ORDER BY r.submitted_at DESC
    LIMIT 500
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'good_count', COALESCE(v_good, 0),
    'bad_count', COALESCE(v_bad, 0),
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_pos_receipt_feedback(uuid, uuid, uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pos_receipt_feedback(uuid, uuid, uuid, text, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_pos_receipt_feedback(
  p_feedback_id uuid,
  p_reply_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pos_receipt_feedback_responses%ROWTYPE;
  v_reply text := nullif(trim(coalesce(p_reply_text, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_reply IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reply_required');
  END IF;

  SELECT r.* INTO v_row
  FROM public.pos_receipt_feedback_responses r
  WHERE r.id = p_feedback_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_organization_id = v_row.organization_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.pos_receipt_feedback_responses
  SET
    reply_text = v_reply,
    replied_by = auth.uid(),
    replied_at = now()
  WHERE id = p_feedback_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'reply_text', v_row.reply_text,
    'replied_at', v_row.replied_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reply_pos_receipt_feedback(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_pos_receipt_feedback(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Permission defaults for Feedback tab
-- ---------------------------------------------------------------------------

INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES (
  '/operations/customers-feedback',
  'Operations — Customers — Feedback',
  true,
  ARRAY['owner', 'admin', 'hr']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id, page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
SELECT o.id, d.page_path, d.page_title, d.is_active, d.roles_allowed, d.job_levels_allowed, d.exceptions, d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/operations/customers-feedback'
  AND NOT EXISTS (
    SELECT 1 FROM public.permission_configurations p
    WHERE p.organization_id = o.id AND p.page_path = d.page_path
  );
