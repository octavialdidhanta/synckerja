-- Piutang / sales payment ↔ income link + transfer verification on payment rows.
-- Safe to re-run: IF NOT EXISTS / exception swallow for duplicate constraint.

-- ---------------------------------------------------------------------------
-- income_transactions.sales_activity_payment_id (1:1 optional link)
-- ---------------------------------------------------------------------------
ALTER TABLE public.income_transactions
  ADD COLUMN IF NOT EXISTS sales_activity_payment_id uuid NULL;

DO $$
BEGIN
  ALTER TABLE public.income_transactions
    ADD CONSTRAINT income_transactions_sales_activity_payment_id_fkey
    FOREIGN KEY (sales_activity_payment_id)
    REFERENCES public.sales_activity_payments (id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_transactions_org_sales_payment_unique
  ON public.income_transactions (organization_id, sales_activity_payment_id)
  WHERE sales_activity_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_transactions_sales_activity_payment_id
  ON public.income_transactions (sales_activity_payment_id)
  WHERE sales_activity_payment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- sales_activity_payments: manual transfer verification (anti-fraud)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_activity_payments
  ADD COLUMN IF NOT EXISTS transfer_verification_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS transfer_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS transfer_verified_by uuid NULL;

DO $$
BEGIN
  ALTER TABLE public.sales_activity_payments
    ADD CONSTRAINT sales_activity_payments_transfer_verified_by_fkey
    FOREIGN KEY (transfer_verified_by) REFERENCES auth.users (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.sales_activity_payments
    ADD CONSTRAINT sales_activity_payments_transfer_verification_status_check
    CHECK (
      transfer_verification_status = ANY (
        ARRAY['unchecked'::text, 'approved'::text, 'rejected'::text]
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
