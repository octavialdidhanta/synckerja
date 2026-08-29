-- Allow re-enqueue to refresh contact + pending channel status after first pay
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
    customer_email = COALESCE(EXCLUDED.customer_email, public.pos_receipt_feedback_invitations.customer_email),
    customer_phone = COALESCE(EXCLUDED.customer_phone, public.pos_receipt_feedback_invitations.customer_phone),
    customer_name = COALESCE(EXCLUDED.customer_name, public.pos_receipt_feedback_invitations.customer_name),
    share_via_email = public.pos_receipt_feedback_invitations.share_via_email OR EXCLUDED.share_via_email,
    share_via_sms = public.pos_receipt_feedback_invitations.share_via_sms OR EXCLUDED.share_via_sms,
    email_status = CASE
      WHEN EXCLUDED.share_via_email AND EXCLUDED.customer_email IS NOT NULL THEN 'pending_send'
      ELSE public.pos_receipt_feedback_invitations.email_status
    END,
    sms_status = CASE
      WHEN EXCLUDED.share_via_sms AND EXCLUDED.customer_phone IS NOT NULL THEN 'pending_send'
      ELSE public.pos_receipt_feedback_invitations.sms_status
    END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
