-- Read digital receipt send flags for a sales activity (invitations table is otherwise blocked for authenticated).
CREATE OR REPLACE FUNCTION public.get_pos_receipt_send_status(p_sales_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_email_status text;
  v_sms_status text;
  v_email_sent_at timestamptz;
  v_sms_sent_at timestamptz;
BEGIN
  IF p_sales_activity_id IS NULL THEN
    RETURN jsonb_build_object('email_sent', false, 'sms_sent', false);
  END IF;

  SELECT sa.organization_id
  INTO v_org
  FROM public.sales_activities sa
  WHERE sa.id = p_sales_activity_id;

  IF v_org IS NULL OR v_org NOT IN (SELECT public.user_organization_ids()) THEN
    RETURN jsonb_build_object('email_sent', false, 'sms_sent', false);
  END IF;

  SELECT i.email_status, i.sms_status, i.email_sent_at, i.sms_sent_at
  INTO v_email_status, v_sms_status, v_email_sent_at, v_sms_sent_at
  FROM public.pos_receipt_feedback_invitations i
  WHERE i.sales_activity_id = p_sales_activity_id;

  RETURN jsonb_build_object(
    'email_sent',
      COALESCE(v_email_status = 'sent', false) OR v_email_sent_at IS NOT NULL,
    'sms_sent',
      COALESCE(v_sms_status = 'sent', false) OR v_sms_sent_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pos_receipt_send_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_receipt_send_status(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_pos_receipt_send_status(uuid) IS
  'Returns { email_sent, sms_sent } for a sales activity digital receipt invitation.';
