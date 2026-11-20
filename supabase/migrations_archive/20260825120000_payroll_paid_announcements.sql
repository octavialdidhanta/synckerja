-- Payroll paid: home announcements (24h), notify idempotency audit action, RPCs.

ALTER TABLE public.payroll_audit_log
  DROP CONSTRAINT IF EXISTS payroll_audit_log_action_check;

ALTER TABLE public.payroll_audit_log
  ADD CONSTRAINT payroll_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'calculated'::text,
    'reprocessed'::text,
    'marked_paid'::text,
    'export_bank'::text,
    'payslip_generated'::text,
    'xendit_disburse_batch'::text,
    'payslip_notified'::text
  ]::text[]));

CREATE TABLE IF NOT EXISTS public.employee_payroll_paid_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  calculation_id uuid NOT NULL UNIQUE REFERENCES public.employee_payroll_calculations (id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  period_label text NOT NULL,
  bank_name text,
  account_last4 text,
  finance_tip_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_paid_announcements_user_active
  ON public.employee_payroll_paid_announcements (user_id, expires_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.employee_payroll_paid_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_paid_announcements_own_select ON public.employee_payroll_paid_announcements;
CREATE POLICY payroll_paid_announcements_own_select
  ON public.employee_payroll_paid_announcements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS payroll_paid_announcements_own_dismiss ON public.employee_payroll_paid_announcements;
CREATE POLICY payroll_paid_announcements_own_dismiss
  ON public.employee_payroll_paid_announcements FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Active announcements for home banner (employee self).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_payroll_paid_announcements()
RETURNS TABLE (
  id uuid,
  period_label text,
  bank_name text,
  account_last4 text,
  finance_tip_key text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.period_label,
    a.bank_name,
    a.account_last4,
    a.finance_tip_key,
    a.expires_at,
    a.created_at
  FROM public.employee_payroll_paid_announcements a
  WHERE a.user_id = auth.uid()
    AND a.dismissed_at IS NULL
    AND a.expires_at > now()
  ORDER BY a.created_at DESC
  LIMIT 3;
$$;

REVOKE ALL ON FUNCTION public.get_active_payroll_paid_announcements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_payroll_paid_announcements() TO authenticated;

-- ---------------------------------------------------------------------------
-- Dismiss announcement (employee self).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_payroll_paid_announcement(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.employee_payroll_paid_announcements
  SET dismissed_at = now()
  WHERE id = p_announcement_id
    AND user_id = auth.uid()
    AND dismissed_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Announcement not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_payroll_paid_announcement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_payroll_paid_announcement(uuid) TO authenticated;
