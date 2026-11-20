-- Security Advisor: enable RLS on public.payments (was explicitly disabled in org_subscriptions revamp).
-- Payments are referenced by organization_subscriptions.last_payment_id; no direct org column on payments.

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_for_org_members" ON public.payments;
CREATE POLICY "payments_select_for_org_members"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_subscriptions os
      WHERE os.last_payment_id = payments.id
        AND os.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- Inserts/updates/deletes: service role (Edge Functions, webhooks) bypass RLS.
-- Authenticated clients do not get direct write access unless you add explicit policies later.
