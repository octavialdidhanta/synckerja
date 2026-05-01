-- Allow income_allocations to reference debt_payments (allocate-from-income on Pay Debt).
-- Previously expense_id was NOT NULL and the trigger only validated expenses, so inserts
-- with debt_payment_id failed and the client showed allocationLinkFailed.

-- ---------------------------------------------------------------------------
-- debt_payments (baseline for DBs that only had app-side usage / remote DDL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  payment_amount numeric(15, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date date NOT NULL,
  payment_method uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  notes text NULL,
  transaction_reference text NULL,
  receipt_file_path text NULL,
  receipt_file_name text NULL,
  receipt_file_size bigint NULL,
  receipt_mime_type text NULL,
  principal_amount numeric(15, 2) NULL,
  interest_amount numeric(15, 2) NULL,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_organization_id ON public.debt_payments (organization_id);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments (debt_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_payments_org_transaction_ref_unique
  ON public.debt_payments (organization_id, transaction_reference)
  WHERE
    transaction_reference IS NOT NULL
    AND btrim(transaction_reference) <> ''::text;

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debt_payments_org_select" ON public.debt_payments;
CREATE POLICY "debt_payments_org_select"
  ON public.debt_payments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debt_payments_org_insert" ON public.debt_payments;
CREATE POLICY "debt_payments_org_insert"
  ON public.debt_payments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debt_payments_org_update" ON public.debt_payments;
CREATE POLICY "debt_payments_org_update"
  ON public.debt_payments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debt_payments_org_delete" ON public.debt_payments;
CREATE POLICY "debt_payments_org_delete"
  ON public.debt_payments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- income_allocations: optional expense_id OR debt_payment_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.income_allocations
  ADD COLUMN IF NOT EXISTS debt_payment_id uuid NULL;

ALTER TABLE public.income_allocations
  DROP CONSTRAINT IF EXISTS income_allocations_debt_payment_id_fkey;

ALTER TABLE public.income_allocations
  ADD CONSTRAINT income_allocations_debt_payment_id_fkey FOREIGN KEY (debt_payment_id) REFERENCES public.debt_payments (id) ON DELETE CASCADE;

ALTER TABLE public.income_allocations
  ALTER COLUMN expense_id DROP NOT NULL;

ALTER TABLE public.income_allocations
  DROP CONSTRAINT IF EXISTS income_allocations_expense_or_debt_check;

ALTER TABLE public.income_allocations
  ADD CONSTRAINT income_allocations_expense_or_debt_check CHECK (
    (
      expense_id IS NOT NULL
      AND debt_payment_id IS NULL
    )
    OR (
      expense_id IS NULL
      AND debt_payment_id IS NOT NULL
    )
  );

DROP INDEX IF EXISTS idx_income_allocations_income_expense_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_allocations_income_expense_unique_partial
  ON public.income_allocations (income_transaction_id, expense_id)
  WHERE
    expense_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_allocations_income_debt_payment_unique_partial
  ON public.income_allocations (income_transaction_id, debt_payment_id)
  WHERE
    debt_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_allocations_debt_payment_id
  ON public.income_allocations (debt_payment_id)
  WHERE
    debt_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._tg_validate_income_allocation_expense_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_income RECORD;
  v_other_sum NUMERIC(15, 2);
  v_exp RECORD;
  v_pay RECORD;
  v_alloc_to_pay_sum NUMERIC(15, 2);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_IMMUTABLE';
  END IF;

  IF NOT (
    (
      NEW.expense_id IS NOT NULL
      AND NEW.debt_payment_id IS NULL
    )
    OR (
      NEW.expense_id IS NULL
      AND NEW.debt_payment_id IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_TARGET_XOR';
  END IF;

  SELECT
    it.id,
    it.organization_id,
    it.amount,
    it.bank_account_id
  INTO v_income
  FROM public.income_transactions it
  WHERE
    it.id = NEW.income_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_INVALID_INCOME';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_income.organization_id THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_ORG_MISMATCH';
  END IF;

  SELECT
    COALESCE(SUM(ia.amount), 0) INTO v_other_sum
  FROM public.income_allocations ia
  WHERE
    ia.income_transaction_id = NEW.income_transaction_id
    AND ia.id IS DISTINCT FROM NEW.id;

  IF v_other_sum + NEW.amount > v_income.amount THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_EXCEEDS_INCOME';
  END IF;

  IF NEW.expense_id IS NOT NULL THEN
    SELECT
      e.id,
      e.organization_id,
      e.amount,
      e.bank_account_id
    INTO v_exp
    FROM public.expenses e
    WHERE
      e.id = NEW.expense_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_INVALID_EXPENSE';
    END IF;

    IF v_exp.organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_ORG_MISMATCH';
    END IF;

    IF NEW.amount > v_exp.amount THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_EXCEEDS_EXPENSE';
    END IF;

    IF v_income.bank_account_id IS NOT NULL AND v_exp.bank_account_id IS NOT NULL THEN
      IF v_income.bank_account_id IS DISTINCT FROM v_exp.bank_account_id THEN
        RAISE EXCEPTION 'INCOME_ALLOCATION_BANK_MISMATCH';
      END IF;
    END IF;
  ELSE
    SELECT
      dp.id,
      dp.organization_id,
      dp.payment_amount,
      dp.payment_method
    INTO v_pay
    FROM public.debt_payments dp
    WHERE
      dp.id = NEW.debt_payment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_INVALID_DEBT_PAYMENT';
    END IF;

    IF v_pay.organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_ORG_MISMATCH';
    END IF;

    IF v_pay.payment_method IS NULL THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_DEBT_PAYMENT_NO_BANK';
    END IF;

    IF NEW.amount > v_pay.payment_amount THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_EXCEEDS_DEBT_PAYMENT';
    END IF;

    SELECT
      COALESCE(SUM(ia.amount), 0) INTO v_alloc_to_pay_sum
    FROM public.income_allocations ia
    WHERE
      ia.debt_payment_id = NEW.debt_payment_id
      AND ia.id IS DISTINCT FROM NEW.id;

    IF v_alloc_to_pay_sum + NEW.amount > v_pay.payment_amount THEN
      RAISE EXCEPTION 'INCOME_ALLOCATION_DEBT_PAYMENT_OVER_ALLOCATED';
    END IF;

    IF v_income.bank_account_id IS NOT NULL AND v_pay.payment_method IS NOT NULL THEN
      IF v_income.bank_account_id IS DISTINCT FROM v_pay.payment_method THEN
        RAISE EXCEPTION 'INCOME_ALLOCATION_BANK_MISMATCH';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public._tg_validate_income_allocation_expense_only () IS 'Validates income_allocations: either expense_id (expense path) or debt_payment_id (debt payment path).';
