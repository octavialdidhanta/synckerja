-- Expenses + debt/expense trigger chain (reference: expense_triggers_after_insert_update_for_recalculate + soft delete).
-- Recalculate Pinjaman Online: no debt_payments table required (uses expenses SUM + debts.paid_amount).
-- company_assets: add FKs to purchase_requests / expenses / auth.users when missing; default status; updated_at trigger.

-- ---------------------------------------------------------------------------
-- recalculate_pinjaman_online_debt_amount (reference-aligned, no debt_payments)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_pinjaman_online_debt_amount (p_debt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt public.debts%ROWTYPE;
  v_total_expense numeric(15, 2);
  v_remaining numeric(15, 2);
  v_paid numeric(15, 2);
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id;
  IF NOT FOUND OR v_debt.debt_type IS DISTINCT FROM 'Pinjaman Online' THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_total_expense
  FROM public.expenses
  WHERE withdrawal_from_balance = p_debt_id
    AND status IS DISTINCT FROM 'deleted';

  v_paid := coalesce(v_debt.paid_amount, 0);
  v_remaining := greatest(0, v_total_expense - v_paid);

  UPDATE public.debts
  SET
    debt_amount = v_total_expense,
    remaining_debt = v_remaining,
    available_limit = greatest(0, coalesce(limit_amount, 0) - v_remaining),
    updated_at = now()
  WHERE id = p_debt_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- expenses (reference DDL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  expense_name text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  expense_type text NOT NULL,
  category text NOT NULL,
  department text NULL,
  create_date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text NULL,
  first_payment_date date NULL,
  next_payment_date date NULL,
  description text NULL,
  receipt_url text NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expense_type_id uuid NULL REFERENCES public.expense_types (id),
  expense_category_id uuid NULL REFERENCES public.expense_categories (id),
  withdrawal_from_balance uuid NULL REFERENCES public.debts (id) ON DELETE SET NULL,
  bank_account_id uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  purchase_request_id uuid NULL REFERENCES public.purchase_requests (id) ON DELETE SET NULL,
  receipt_urls jsonb NULL,
  recurring_settlement_for_expense_id uuid NULL REFERENCES public.expenses (id) ON DELETE SET NULL,
  transaction_reference text NULL,
  exclude_from_reminder_bills boolean NOT NULL DEFAULT false,
  CONSTRAINT expenses_recurring_frequency_check CHECK (
    (is_recurring = false AND recurring_frequency IS NULL)
    OR (
      is_recurring = true
      AND recurring_frequency = ANY (
        ARRAY[
          'daily'::text,
          'weekly'::text,
          'biweekly'::text,
          'monthly'::text,
          'quarterly'::text,
          'semiannually'::text,
          'annually'::text
        ]
      )
    )
  ),
  CONSTRAINT expenses_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'inactive'::text, 'deleted'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON public.expenses USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_create_date ON public.expenses USING btree (create_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses USING btree (status);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type_id ON public.expenses USING btree (expense_type_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_category_id ON public.expenses USING btree (expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_exclude_reminder ON public.expenses USING btree (organization_id) WHERE exclude_from_reminder_bills = true;
CREATE INDEX IF NOT EXISTS idx_expenses_purchase_request_id ON public.expenses USING btree (purchase_request_id) WHERE purchase_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_withdrawal_from_balance ON public.expenses USING btree (withdrawal_from_balance);
CREATE INDEX IF NOT EXISTS idx_expenses_bank_account_id ON public.expenses USING btree (bank_account_id) WHERE bank_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_org_transaction_ref_unique ON public.expenses USING btree (organization_id, transaction_reference)
WHERE transaction_reference IS NOT NULL AND btrim(transaction_reference) <> ''::text AND status IS DISTINCT FROM 'deleted'::text;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_settlement_for_expense_id ON public.expenses USING btree (recurring_settlement_for_expense_id) WHERE recurring_settlement_for_expense_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_updated_at ON public.expenses;
CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_expenses_updated_at();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_org_select" ON public.expenses;
CREATE POLICY "expenses_org_select"
  ON public.expenses FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "expenses_org_insert" ON public.expenses;
CREATE POLICY "expenses_org_insert"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "expenses_org_update" ON public.expenses;
CREATE POLICY "expenses_org_update"
  ON public.expenses FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "expenses_org_delete" ON public.expenses;
CREATE POLICY "expenses_org_delete"
  ON public.expenses FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Expense / debt triggers (synckerja-reference: validate BEFORE, update AFTER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_expense_insert_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_record record;
  v_available_limit numeric(15, 2);
BEGIN
  IF NEW.withdrawal_from_balance IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
  INTO v_debt_record
  FROM public.debts
  WHERE id = NEW.withdrawal_from_balance
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
  END IF;

  IF v_debt_record.status != 'active' THEN
    RAISE EXCEPTION 'Cannot use debt with status %. Only active debts can be used.', v_debt_record.status;
  END IF;

  v_available_limit := coalesce(v_debt_record.available_limit, v_debt_record.limit_amount);
  IF v_available_limit < NEW.amount THEN
    RAISE EXCEPTION 'Insufficient available limit. Available: %, Required: %',
      v_available_limit, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_expense_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_record record;
BEGIN
  IF NEW.withdrawal_from_balance IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
  INTO v_debt_record
  FROM public.debts
  WHERE id = NEW.withdrawal_from_balance
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
  END IF;

  UPDATE public.debts
  SET
    available_limit = coalesce(available_limit, limit_amount) - NEW.amount,
    debt_amount = CASE
      WHEN v_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
      ELSE coalesce(debt_amount, 0) + NEW.amount
    END,
    updated_at = now()
  WHERE id = NEW.withdrawal_from_balance;

  IF v_debt_record.debt_type = 'Pinjaman Online' THEN
    PERFORM public.recalculate_pinjaman_online_debt_amount (NEW.withdrawal_from_balance);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_expense_update_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_record record;
  v_available_limit numeric(15, 2);
  v_amount_diff numeric(15, 2);
BEGIN
  v_amount_diff := NEW.amount - OLD.amount;

  IF (OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance) THEN
    IF NEW.withdrawal_from_balance IS NOT NULL THEN
      SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
      INTO v_debt_record
      FROM public.debts
      WHERE id = NEW.withdrawal_from_balance
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
      END IF;

      IF v_debt_record.status != 'active' THEN
        RAISE EXCEPTION 'Cannot use debt with status %. Only active debts can be used.', v_debt_record.status;
      END IF;

      v_available_limit := coalesce(v_debt_record.available_limit, v_debt_record.limit_amount);
      IF v_available_limit < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient available limit. Available: %, Required: %',
          v_available_limit, NEW.amount;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.withdrawal_from_balance IS NOT NULL AND v_amount_diff > 0 THEN
    SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
    INTO v_debt_record
    FROM public.debts
    WHERE id = OLD.withdrawal_from_balance
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Debt with id % not found', OLD.withdrawal_from_balance;
    END IF;

    v_available_limit := coalesce(v_debt_record.available_limit, v_debt_record.limit_amount);
    IF v_available_limit < v_amount_diff THEN
      RAISE EXCEPTION 'Insufficient available limit. Available: %, Required additional: %',
        v_available_limit, v_amount_diff;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_expense_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_debt_record record;
  v_new_debt_record record;
  v_amount_diff numeric(15, 2);
BEGIN
  v_amount_diff := NEW.amount - OLD.amount;

  IF (OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance) THEN
    IF OLD.withdrawal_from_balance IS NOT NULL THEN
      SELECT debt_type INTO v_old_debt_record FROM public.debts WHERE id = OLD.withdrawal_from_balance;
      UPDATE public.debts
      SET
        available_limit = coalesce(available_limit, limit_amount) + OLD.amount,
        debt_amount = CASE
          WHEN v_old_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
          ELSE greatest(0, coalesce(debt_amount, 0) - OLD.amount)
        END,
        updated_at = now()
      WHERE id = OLD.withdrawal_from_balance;

      IF v_old_debt_record.debt_type = 'Pinjaman Online' THEN
        PERFORM public.recalculate_pinjaman_online_debt_amount (OLD.withdrawal_from_balance);
      END IF;
    END IF;

    IF NEW.withdrawal_from_balance IS NOT NULL THEN
      SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
      INTO v_new_debt_record
      FROM public.debts
      WHERE id = NEW.withdrawal_from_balance
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
      END IF;

      UPDATE public.debts
      SET
        available_limit = coalesce(available_limit, limit_amount) - NEW.amount,
        debt_amount = CASE
          WHEN v_new_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
          ELSE coalesce(debt_amount, 0) + NEW.amount
        END,
        updated_at = now()
      WHERE id = NEW.withdrawal_from_balance;

      IF v_new_debt_record.debt_type = 'Pinjaman Online' THEN
        PERFORM public.recalculate_pinjaman_online_debt_amount (NEW.withdrawal_from_balance);
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.withdrawal_from_balance IS NOT NULL AND v_amount_diff != 0 THEN
    SELECT id, limit_amount, available_limit, debt_amount, status, debt_type
    INTO v_old_debt_record
    FROM public.debts
    WHERE id = OLD.withdrawal_from_balance
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Debt with id % not found', OLD.withdrawal_from_balance;
    END IF;

    UPDATE public.debts
    SET
      available_limit = coalesce(available_limit, limit_amount) - v_amount_diff,
      debt_amount = CASE
        WHEN v_old_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
        ELSE coalesce(debt_amount, 0) + v_amount_diff
      END,
      updated_at = now()
    WHERE id = OLD.withdrawal_from_balance;

    IF v_old_debt_record.debt_type = 'Pinjaman Online' THEN
      PERFORM public.recalculate_pinjaman_online_debt_amount (OLD.withdrawal_from_balance);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_expense_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_record record;
BEGIN
  IF OLD.withdrawal_from_balance IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT debt_type INTO v_debt_record FROM public.debts WHERE id = OLD.withdrawal_from_balance;

  UPDATE public.debts
  SET
    available_limit = coalesce(available_limit, limit_amount) + OLD.amount,
    debt_amount = CASE
      WHEN v_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
      ELSE greatest(0, coalesce(debt_amount, 0) - OLD.amount)
    END,
    updated_at = now()
  WHERE id = OLD.withdrawal_from_balance;

  IF v_debt_record.debt_type = 'Pinjaman Online' THEN
    PERFORM public.recalculate_pinjaman_online_debt_amount (OLD.withdrawal_from_balance);
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_expense_soft_delete_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_record record;
BEGIN
  IF OLD.status IS DISTINCT FROM 'active' OR NEW.status IS DISTINCT FROM 'deleted' THEN
    RETURN NEW;
  END IF;

  IF OLD.withdrawal_from_balance IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT debt_type INTO v_debt_record FROM public.debts WHERE id = OLD.withdrawal_from_balance;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.debts
  SET
    available_limit = coalesce(available_limit, limit_amount) + OLD.amount,
    debt_amount = CASE
      WHEN v_debt_record.debt_type = 'Pinjaman Online' THEN debt_amount
      ELSE greatest(0, coalesce(debt_amount, 0) - OLD.amount)
    END,
    updated_at = now()
  WHERE id = OLD.withdrawal_from_balance;

  IF v_debt_record.debt_type = 'Pinjaman Online' THEN
    PERFORM public.recalculate_pinjaman_online_debt_amount (OLD.withdrawal_from_balance);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_expense_insert_validate ON public.expenses;
DROP TRIGGER IF EXISTS trigger_expense_insert_debt_update ON public.expenses;
DROP TRIGGER IF EXISTS trigger_expense_update_validate ON public.expenses;
DROP TRIGGER IF EXISTS trigger_expense_update_debt_update ON public.expenses;
DROP TRIGGER IF EXISTS trigger_expense_delete_debt_update ON public.expenses;
DROP TRIGGER IF EXISTS trigger_expense_soft_delete_debt_reversal ON public.expenses;

CREATE TRIGGER trigger_expense_insert_validate
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_insert_debt();

CREATE TRIGGER trigger_expense_insert_debt_update
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_insert();

CREATE TRIGGER trigger_expense_update_validate
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  WHEN (
    OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance
    OR OLD.amount IS DISTINCT FROM NEW.amount
  )
  EXECUTE FUNCTION public.validate_expense_update_debt();

CREATE TRIGGER trigger_expense_update_debt_update
  AFTER UPDATE ON public.expenses
  FOR EACH ROW
  WHEN (
    OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance
    OR OLD.amount IS DISTINCT FROM NEW.amount
  )
  EXECUTE FUNCTION public.handle_expense_update();

CREATE TRIGGER trigger_expense_delete_debt_update
  AFTER DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_delete();

CREATE TRIGGER trigger_expense_soft_delete_debt_reversal
  AFTER UPDATE OF status ON public.expenses
  FOR EACH ROW
  WHEN (
    OLD.status = 'active'
    AND NEW.status = 'deleted'
    AND OLD.withdrawal_from_balance IS NOT NULL
  )
  EXECUTE FUNCTION public.handle_expense_soft_delete_debt();

DO $$
DECLARE
  v_debt record;
BEGIN
  FOR v_debt IN SELECT id FROM public.debts WHERE debt_type = 'Pinjaman Online'
  LOOP
    PERFORM public.recalculate_pinjaman_online_debt_amount(v_debt.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.validate_expense_insert_debt() IS 'BEFORE INSERT: validate debt / available_limit (reference).';
COMMENT ON FUNCTION public.validate_expense_update_debt() IS 'BEFORE UPDATE: validate when amount or withdrawal changes (reference).';
COMMENT ON FUNCTION public.handle_expense_insert() IS 'AFTER INSERT: update debt + recalculate Pinjaman Online (reference).';
COMMENT ON FUNCTION public.handle_expense_update() IS 'AFTER UPDATE: update debt + recalculate Pinjaman Online (reference).';
COMMENT ON FUNCTION public.handle_expense_delete() IS 'AFTER DELETE: reverse debt + recalculate Pinjaman Online (reference).';
COMMENT ON FUNCTION public.recalculate_pinjaman_online_debt_amount(uuid) IS 'Pinjaman Online: sync debt_amount / remaining_debt / available_limit from expenses + paid_amount (no debt_payments table).';

-- ---------------------------------------------------------------------------
-- company_assets: FKs + default status + updated_at (reference)
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_assets
  ALTER COLUMN status SET DEFAULT 'available';

CREATE OR REPLACE FUNCTION public.update_company_assets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_company_assets_updated_at_trigger ON public.company_assets;
CREATE TRIGGER update_company_assets_updated_at_trigger
  BEFORE UPDATE ON public.company_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_company_assets_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_assets_purchase_request_id_fkey'
  ) THEN
    ALTER TABLE public.company_assets
      ADD CONSTRAINT company_assets_purchase_request_id_fkey
      FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_assets_expense_id_fkey'
  ) THEN
    ALTER TABLE public.company_assets
      ADD CONSTRAINT company_assets_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES public.expenses (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_assets_receipt_confirmed_by_fkey'
  ) THEN
    ALTER TABLE public.company_assets
      ADD CONSTRAINT company_assets_receipt_confirmed_by_fkey
      FOREIGN KEY (receipt_confirmed_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;
