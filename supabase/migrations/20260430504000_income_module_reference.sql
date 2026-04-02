-- Income module + internal bank transfer (reference-aligned).
-- Depends on: organizations, bank_accounts, bank_account_balances, bank_account_balance_history, expenses, expense_types, expense_categories.

-- ---------------------------------------------------------------------------
-- services / sub_services
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_organization_id ON public.services USING btree (organization_id);

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_org_select" ON public.services;
CREATE POLICY "services_org_select"
  ON public.services FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "services_org_insert" ON public.services;
CREATE POLICY "services_org_insert"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "services_org_update" ON public.services;
CREATE POLICY "services_org_update"
  ON public.services FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "services_org_delete" ON public.services;
CREATE POLICY "services_org_delete"
  ON public.services FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

CREATE TABLE IF NOT EXISTS public.sub_services (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_services_organization_id ON public.sub_services USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_services_service_id ON public.sub_services USING btree (service_id);

DROP TRIGGER IF EXISTS update_sub_services_updated_at ON public.sub_services;
CREATE TRIGGER update_sub_services_updated_at
  BEFORE UPDATE ON public.sub_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.sub_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_services_org_select" ON public.sub_services;
CREATE POLICY "sub_services_org_select"
  ON public.sub_services FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sub_services_org_insert" ON public.sub_services;
CREATE POLICY "sub_services_org_insert"
  ON public.sub_services FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sub_services_org_update" ON public.sub_services;
CREATE POLICY "sub_services_org_update"
  ON public.sub_services FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sub_services_org_delete" ON public.sub_services;
CREATE POLICY "sub_services_org_delete"
  ON public.sub_services FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- income_types / income_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_types (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  organization_id uuid NULL REFERENCES public.organizations (id),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_types_organization_id ON public.income_types (organization_id);

DROP TRIGGER IF EXISTS update_income_types_updated_at ON public.income_types;
CREATE TRIGGER update_income_types_updated_at
  BEFORE UPDATE ON public.income_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.income_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_types_org_select" ON public.income_types;
CREATE POLICY "income_types_org_select"
  ON public.income_types FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_types_org_insert" ON public.income_types;
CREATE POLICY "income_types_org_insert"
  ON public.income_types FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_types_org_update" ON public.income_types;
CREATE POLICY "income_types_org_update"
  ON public.income_types FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_types_org_delete" ON public.income_types;
CREATE POLICY "income_types_org_delete"
  ON public.income_types FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

CREATE TABLE IF NOT EXISTS public.income_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  income_types_id uuid NULL REFERENCES public.income_types (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_categories_organization_id ON public.income_categories (organization_id);
CREATE INDEX IF NOT EXISTS idx_income_categories_income_types_id ON public.income_categories (income_types_id);

DROP TRIGGER IF EXISTS update_income_categories_updated_at ON public.income_categories;
CREATE TRIGGER update_income_categories_updated_at
  BEFORE UPDATE ON public.income_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_categories_org_select" ON public.income_categories;
CREATE POLICY "income_categories_org_select"
  ON public.income_categories FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_categories_org_insert" ON public.income_categories;
CREATE POLICY "income_categories_org_insert"
  ON public.income_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_categories_org_update" ON public.income_categories;
CREATE POLICY "income_categories_org_update"
  ON public.income_categories FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "income_categories_org_delete" ON public.income_categories;
CREATE POLICY "income_categories_org_delete"
  ON public.income_categories FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- income_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  amount numeric(15, 2) NOT NULL,
  customer_name text NULL,
  payment_method text NULL,
  bank_account_id uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  income_type_id uuid NULL REFERENCES public.income_types (id) ON DELETE SET NULL,
  category_id uuid NULL REFERENCES public.income_categories (id) ON DELETE SET NULL,
  service_id uuid NULL REFERENCES public.services (id) ON DELETE SET NULL,
  sub_service_id uuid NULL REFERENCES public.sub_services (id) ON DELETE SET NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text NULL,
  description text NULL,
  receipt_file_path text NULL,
  receipt_file_name text NULL,
  receipt_file_size bigint NULL,
  receipt_mime_type text NULL,
  transaction_reference text NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT income_transactions_status_check CHECK (
    status = ANY (ARRAY['completed'::text, 'pending'::text, 'cancelled'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_income_transactions_organization_id ON public.income_transactions (organization_id);
CREATE INDEX IF NOT EXISTS idx_income_transactions_transaction_date ON public.income_transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_income_transactions_bank_account_id ON public.income_transactions (bank_account_id)
  WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_income_transactions_status ON public.income_transactions (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_transactions_org_transaction_ref_unique
  ON public.income_transactions (organization_id, transaction_reference)
  WHERE transaction_reference IS NOT NULL AND btrim(transaction_reference) <> ''::text;

DROP TRIGGER IF EXISTS update_income_transactions_updated_at ON public.income_transactions;
CREATE TRIGGER update_income_transactions_updated_at
  BEFORE UPDATE ON public.income_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_transactions_org_select" ON public.income_transactions;
CREATE POLICY "income_transactions_org_select"
  ON public.income_transactions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "income_transactions_org_insert" ON public.income_transactions;
CREATE POLICY "income_transactions_org_insert"
  ON public.income_transactions FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "income_transactions_org_update" ON public.income_transactions;
CREATE POLICY "income_transactions_org_update"
  ON public.income_transactions FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "income_transactions_org_delete" ON public.income_transactions;
CREATE POLICY "income_transactions_org_delete"
  ON public.income_transactions FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- income_allocations (expense-linked only; no debt_payments in this project)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  income_transaction_id uuid NOT NULL REFERENCES public.income_transactions (id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  expense_id uuid NOT NULL REFERENCES public.expenses (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_allocations_income_expense_unique
  ON public.income_allocations (income_transaction_id, expense_id);

CREATE INDEX IF NOT EXISTS idx_income_allocations_organization_id
  ON public.income_allocations (organization_id);

CREATE INDEX IF NOT EXISTS idx_income_allocations_income_transaction_id
  ON public.income_allocations (income_transaction_id);

CREATE INDEX IF NOT EXISTS idx_income_allocations_expense_id
  ON public.income_allocations (expense_id);

CREATE OR REPLACE FUNCTION public._tg_validate_income_allocation_expense_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_income RECORD;
  v_other_sum NUMERIC(15, 2);
  v_exp RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_IMMUTABLE';
  END IF;

  SELECT it.id, it.organization_id, it.amount, it.bank_account_id
  INTO v_income
  FROM public.income_transactions it
  WHERE it.id = NEW.income_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_INVALID_INCOME';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_income.organization_id THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_ORG_MISMATCH';
  END IF;

  SELECT COALESCE(SUM(ia.amount), 0) INTO v_other_sum
  FROM public.income_allocations ia
  WHERE ia.income_transaction_id = NEW.income_transaction_id
    AND ia.id IS DISTINCT FROM NEW.id;

  IF v_other_sum + NEW.amount > v_income.amount THEN
    RAISE EXCEPTION 'INCOME_ALLOCATION_EXCEEDS_INCOME';
  END IF;

  SELECT e.id, e.organization_id, e.amount, e.bank_account_id
  INTO v_exp
  FROM public.expenses e
  WHERE e.id = NEW.expense_id;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_income_allocation ON public.income_allocations;
CREATE TRIGGER trg_validate_income_allocation
  BEFORE INSERT OR UPDATE ON public.income_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public._tg_validate_income_allocation_expense_only();

CREATE OR REPLACE FUNCTION public._tg_lock_income_if_allocated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.income_allocations ia WHERE ia.income_transaction_id = OLD.id) THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id
      OR NEW.transaction_date IS DISTINCT FROM OLD.transaction_date
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
      OR NEW.income_type_id IS DISTINCT FROM OLD.income_type_id
      OR NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.service_id IS DISTINCT FROM OLD.service_id
      OR NEW.sub_service_id IS DISTINCT FROM OLD.sub_service_id
      OR NEW.is_recurring IS DISTINCT FROM OLD.is_recurring
      OR NEW.recurring_frequency IS DISTINCT FROM OLD.recurring_frequency
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    THEN
      RAISE EXCEPTION 'INCOME_HAS_ALLOCATIONS';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_income_if_allocated ON public.income_transactions;
CREATE TRIGGER trg_lock_income_if_allocated
  BEFORE UPDATE ON public.income_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public._tg_lock_income_if_allocated();

ALTER TABLE public.income_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_allocations_select_org" ON public.income_allocations;
CREATE POLICY "income_allocations_select_org"
  ON public.income_allocations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "income_allocations_insert_org" ON public.income_allocations;
CREATE POLICY "income_allocations_insert_org"
  ON public.income_allocations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "income_allocations_delete_org" ON public.income_allocations;
CREATE POLICY "income_allocations_delete_org"
  ON public.income_allocations FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Internal bank transfer seed + journal + RPCs
-- ---------------------------------------------------------------------------
INSERT INTO public.expense_types (name, organization_id, is_active, is_default, description)
SELECT 'Internal bank transfer', NULL, true, false, 'System use: inter-account bank transfers'
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_types et
  WHERE et.organization_id IS NULL AND lower(trim(et.name)) = lower(trim('Internal bank transfer'))
);

INSERT INTO public.expense_categories (name, organization_id, expense_type_id, is_active, is_default, description)
SELECT
  'Internal bank transfer',
  NULL,
  s.id,
  true,
  false,
  'System use: inter-account bank transfers'
FROM (
  SELECT et.id
  FROM public.expense_types et
  WHERE et.organization_id IS NULL AND lower(trim(et.name)) = lower(trim('Internal bank transfer'))
  ORDER BY et.created_at NULLS LAST
  LIMIT 1
) s
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories ec
  WHERE ec.organization_id IS NULL
    AND ec.expense_type_id = s.id
    AND lower(trim(ec.name)) = lower(trim('Internal bank transfer'))
);

CREATE TABLE IF NOT EXISTS public.bank_transfer_journals (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  from_bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE RESTRICT,
  to_bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL,
  fee numeric(15, 2) NOT NULL DEFAULT 0,
  expense_id uuid NULL REFERENCES public.expenses (id) ON DELETE RESTRICT,
  income_transaction_id uuid NULL REFERENCES public.income_transactions (id) ON DELETE RESTRICT,
  note text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transfer_journals_amount_positive CHECK (amount > 0),
  CONSTRAINT bank_transfer_journals_fee_non_negative CHECK (fee >= 0),
  CONSTRAINT bank_transfer_journals_different_accounts CHECK (from_bank_account_id <> to_bank_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_organization_id
  ON public.bank_transfer_journals (organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_created_at
  ON public.bank_transfer_journals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_income_transaction_id
  ON public.bank_transfer_journals (income_transaction_id)
  WHERE income_transaction_id IS NOT NULL;

ALTER TABLE public.bank_transfer_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transfer_journals_org_select" ON public.bank_transfer_journals;
CREATE POLICY "bank_transfer_journals_org_select"
  ON public.bank_transfer_journals FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.bank_transfer_journals IS 'Inter-bank transfers: optional expense (fee); optional legacy income row; principal via journal when income_transaction_id IS NULL';

CREATE OR REPLACE FUNCTION public._computed_bank_balance(p_bank_account_id uuid, p_org_id uuid)
RETURNS numeric(15, 2)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(it.amount::NUMERIC)
      FROM public.income_transactions it
      WHERE it.bank_account_id = p_bank_account_id
        AND it.organization_id = p_org_id
        AND it.status IN ('completed', 'pending')
    ), 0)
    - COALESCE((
      SELECT SUM(e.amount::NUMERIC)
      FROM public.expenses e
      WHERE e.bank_account_id = p_bank_account_id
        AND e.organization_id = p_org_id
        AND e.status = 'active'
    ), 0)
    + COALESCE((
      SELECT SUM(btj.amount::NUMERIC)
      FROM public.bank_transfer_journals btj
      WHERE btj.to_bank_account_id = p_bank_account_id
        AND btj.organization_id = p_org_id
        AND btj.income_transaction_id IS NULL
    ), 0)
    - COALESCE((
      SELECT SUM(btj.amount::NUMERIC)
      FROM public.bank_transfer_journals btj
      WHERE btj.from_bank_account_id = p_bank_account_id
        AND btj.organization_id = p_org_id
        AND btj.income_transaction_id IS NULL
    ), 0);
$$;

CREATE OR REPLACE FUNCTION public.create_bank_transfer(
  p_from_bank_account_id uuid,
  p_to_bank_account_id uuid,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_note text DEFAULT NULL,
  p_transaction_date date DEFAULT ((CURRENT_DATE AT TIME ZONE 'UTC'))::DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_from RECORD;
  v_to RECORD;
  v_type_id uuid;
  v_cat_id uuid;
  v_from_balance NUMERIC(15, 2);
  v_to_balance NUMERIC(15, 2);
  v_from_ledger NUMERIC(15, 2);
  v_to_ledger NUMERIC(15, 2);
  v_from_before NUMERIC(15, 2);
  v_to_before NUMERIC(15, 2);
  v_total_out NUMERIC(15, 2);
  v_expense_id uuid;
  v_journal_id uuid;
  v_to_label text;
  v_expense_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_from_bank_account_id = p_to_bank_account_id THEN
    RAISE EXCEPTION 'SAME_ACCOUNT';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_fee IS NULL OR p_fee < 0 THEN
    RAISE EXCEPTION 'INVALID_FEE';
  END IF;

  v_total_out := p_amount + p_fee;

  SELECT p.active_organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization';
  END IF;

  SELECT ba.* INTO v_from
  FROM public.bank_accounts ba
  WHERE ba.id = p_from_bank_account_id
    AND ba.organization_id = v_org_id;

  IF NOT FOUND OR v_from.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_SOURCE_ACCOUNT';
  END IF;

  SELECT ba.* INTO v_to
  FROM public.bank_accounts ba
  WHERE ba.id = p_to_bank_account_id
    AND ba.organization_id = v_org_id;

  IF NOT FOUND OR v_to.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_DESTINATION_ACCOUNT';
  END IF;

  IF p_fee > 0 THEN
    SELECT et.id INTO v_type_id
    FROM public.expense_types et
    WHERE et.organization_id IS NULL
      AND lower(trim(et.name)) = lower(trim('Internal bank transfer'))
    LIMIT 1;

    IF v_type_id IS NULL THEN
      RAISE EXCEPTION 'Internal transfer expense type not configured';
    END IF;

    SELECT ec.id INTO v_cat_id
    FROM public.expense_categories ec
    WHERE ec.organization_id IS NULL
      AND ec.expense_type_id = v_type_id
      AND lower(trim(ec.name)) = lower(trim('Internal bank transfer'))
    LIMIT 1;

    IF v_cat_id IS NULL THEN
      RAISE EXCEPTION 'Internal transfer expense category not configured';
    END IF;
  END IF;

  SELECT b.balance INTO v_from_balance
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = p_from_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_from_balance := public._computed_bank_balance(p_from_bank_account_id, v_org_id);
    INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
    VALUES (p_from_bank_account_id, v_org_id, v_from_balance);
    SELECT b.balance INTO v_from_balance
    FROM public.bank_account_balances b
    WHERE b.bank_account_id = p_from_bank_account_id
      AND b.organization_id = v_org_id
    FOR UPDATE;
  ELSE
    v_from_ledger := public._computed_bank_balance(p_from_bank_account_id, v_org_id);
    IF v_from_balance IS DISTINCT FROM v_from_ledger THEN
      UPDATE public.bank_account_balances
      SET balance = v_from_ledger,
          updated_at = NOW()
      WHERE bank_account_id = p_from_bank_account_id
        AND organization_id = v_org_id;
      v_from_balance := v_from_ledger;
    END IF;
  END IF;

  v_from_before := v_from_balance;
  IF v_from_before < v_total_out THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  SELECT b.balance INTO v_to_balance
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = p_to_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_to_balance := public._computed_bank_balance(p_to_bank_account_id, v_org_id);
    INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
    VALUES (p_to_bank_account_id, v_org_id, v_to_balance);
    SELECT b.balance INTO v_to_balance
    FROM public.bank_account_balances b
    WHERE b.bank_account_id = p_to_bank_account_id
      AND b.organization_id = v_org_id
    FOR UPDATE;
  ELSE
    v_to_ledger := public._computed_bank_balance(p_to_bank_account_id, v_org_id);
    IF v_to_balance IS DISTINCT FROM v_to_ledger THEN
      UPDATE public.bank_account_balances
      SET balance = v_to_ledger,
          updated_at = NOW()
      WHERE bank_account_id = p_to_bank_account_id
        AND organization_id = v_org_id;
      v_to_balance := v_to_ledger;
    END IF;
  END IF;

  v_to_before := v_to_balance;

  v_to_label := coalesce(v_to.name, '') || coalesce(' / ' || v_to.bank_name, '');
  v_expense_id := NULL;

  IF p_fee > 0 THEN
    v_expense_name := 'Bank transfer admin fee (to: ' || v_to_label || ')';

    INSERT INTO public.expenses (
      organization_id,
      expense_name,
      amount,
      expense_type,
      expense_type_id,
      category,
      expense_category_id,
      withdrawal_from_balance,
      bank_account_id,
      create_date,
      is_recurring,
      description,
      created_by,
      status
    ) VALUES (
      v_org_id,
      v_expense_name,
      p_fee,
      'Internal bank transfer',
      v_type_id,
      'Internal bank transfer',
      v_cat_id,
      NULL,
      p_from_bank_account_id,
      p_transaction_date,
      false,
      CASE
        WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0
        THEN 'Internal transfer fee. Principal moved: ' || trim(p_amount::TEXT) || ' (not booked as expense). ' || trim(p_note)
        ELSE 'Internal transfer fee. Principal moved: ' || trim(p_amount::TEXT) || ' (not booked as expense).'
      END,
      v_uid,
      'active'
    )
    RETURNING id INTO v_expense_id;
  END IF;

  INSERT INTO public.bank_transfer_journals (
    organization_id,
    from_bank_account_id,
    to_bank_account_id,
    amount,
    fee,
    expense_id,
    income_transaction_id,
    note,
    created_by
  ) VALUES (
    v_org_id,
    p_from_bank_account_id,
    p_to_bank_account_id,
    p_amount,
    coalesce(p_fee, 0),
    v_expense_id,
    NULL,
    p_note,
    v_uid
  )
  RETURNING id INTO v_journal_id;

  UPDATE public.bank_account_balances
  SET balance = v_from_before - v_total_out,
      updated_at = NOW()
  WHERE bank_account_id = p_from_bank_account_id
    AND organization_id = v_org_id;

  IF p_fee > 0 AND v_expense_id IS NOT NULL THEN
    INSERT INTO public.bank_account_balance_history (
      bank_account_id,
      organization_id,
      transaction_type,
      transaction_id,
      amount,
      balance_before,
      balance_after,
      description,
      created_by
    ) VALUES (
      p_from_bank_account_id,
      v_org_id,
      'expense',
      v_expense_id,
      -p_fee,
      v_from_before,
      v_from_before - p_fee,
      'Bank transfer admin fee',
      v_uid
    );

    INSERT INTO public.bank_account_balance_history (
      bank_account_id,
      organization_id,
      transaction_type,
      transaction_id,
      amount,
      balance_before,
      balance_after,
      description,
      created_by
    ) VALUES (
      p_from_bank_account_id,
      v_org_id,
      'manual_adjustment',
      NULL,
      -p_amount,
      v_from_before - p_fee,
      v_from_before - v_total_out,
      'Bank transfer principal out',
      v_uid
    );
  ELSE
    INSERT INTO public.bank_account_balance_history (
      bank_account_id,
      organization_id,
      transaction_type,
      transaction_id,
      amount,
      balance_before,
      balance_after,
      description,
      created_by
    ) VALUES (
      p_from_bank_account_id,
      v_org_id,
      'manual_adjustment',
      NULL,
      -p_amount,
      v_from_before,
      v_from_before - v_total_out,
      'Bank transfer out (no fee)',
      v_uid
    );
  END IF;

  UPDATE public.bank_account_balances
  SET balance = v_to_before + p_amount,
      updated_at = NOW()
  WHERE bank_account_id = p_to_bank_account_id
    AND organization_id = v_org_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_to_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    p_amount,
    v_to_before,
    v_to_before + p_amount,
    'Bank transfer in',
    v_uid
  );

  RETURN json_build_object(
    'journal_id', v_journal_id,
    'expense_id', v_expense_id,
    'income_transaction_id', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_bank_transfer(uuid, uuid, numeric, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bank_transfer(uuid, uuid, numeric, numeric, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_bank_transfer_by_journal_id(p_journal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  j RECORD;
  v_total_out NUMERIC(15, 2);
  v_from_ledger NUMERIC(15, 2);
  v_to_ledger NUMERIC(15, 2);
  v_from_after NUMERIC(15, 2);
  v_to_after NUMERIC(15, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.active_organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization';
  END IF;

  SELECT * INTO j
  FROM public.bank_transfer_journals btj
  WHERE btj.id = p_journal_id
    AND btj.organization_id = v_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BANK_TRANSFER_JOURNAL_NOT_FOUND';
  END IF;

  IF j.income_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'LEGACY_TRANSFER_USE_INCOME_DELETE';
  END IF;

  v_total_out := j.amount + j.fee;

  v_to_ledger := public._computed_bank_balance(j.to_bank_account_id, v_org_id);
  v_from_ledger := public._computed_bank_balance(j.from_bank_account_id, v_org_id);

  IF v_to_ledger < j.amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_DEST_TO_DELETE_TRANSFER';
  END IF;

  v_to_after := v_to_ledger - j.amount;
  v_from_after := v_from_ledger + v_total_out;

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (j.from_bank_account_id, v_org_id, v_from_after)
  ON CONFLICT (bank_account_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      updated_at = NOW();

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.from_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    v_total_out,
    v_from_ledger,
    v_from_after,
    'Revert bank transfer (by journal)',
    v_uid
  );

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (j.to_bank_account_id, v_org_id, v_to_after)
  ON CONFLICT (bank_account_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      updated_at = NOW();

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.to_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    -j.amount,
    v_to_ledger,
    v_to_after,
    'Revert bank transfer credit (by journal)',
    v_uid
  );

  DELETE FROM public.bank_transfer_journals
  WHERE id = j.id;

  IF j.expense_id IS NOT NULL THEN
    DELETE FROM public.expenses
    WHERE id = j.expense_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_bank_transfer_by_journal_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_bank_transfer_by_journal_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_bank_transfer_by_income_transaction(p_income_transaction_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  j RECORD;
  v_from_before NUMERIC(15, 2);
  v_to_before NUMERIC(15, 2);
  v_total_out NUMERIC(15, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.active_organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization';
  END IF;

  SELECT * INTO j
  FROM public.bank_transfer_journals btj
  WHERE btj.income_transaction_id = p_income_transaction_id
    AND btj.organization_id = v_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_BANK_TRANSFER_INCOME';
  END IF;

  v_total_out := j.amount + j.fee;

  SELECT b.balance INTO v_from_before
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = j.from_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOURCE_BALANCE_ROW_MISSING';
  END IF;

  SELECT b.balance INTO v_to_before
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = j.to_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEST_BALANCE_ROW_MISSING';
  END IF;

  IF v_to_before < j.amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_DEST_TO_DELETE_TRANSFER';
  END IF;

  UPDATE public.bank_account_balances
  SET balance = v_from_before + v_total_out,
      updated_at = NOW()
  WHERE bank_account_id = j.from_bank_account_id
    AND organization_id = v_org_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.from_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    v_total_out,
    v_from_before,
    v_from_before + v_total_out,
    'Revert bank transfer (delete paired income/expense)',
    v_uid
  );

  UPDATE public.bank_account_balances
  SET balance = v_to_before - j.amount,
      updated_at = NOW()
  WHERE bank_account_id = j.to_bank_account_id
    AND organization_id = v_org_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.to_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    -j.amount,
    v_to_before,
    v_to_before - j.amount,
    'Revert bank transfer (remove credit to destination)',
    v_uid
  );

  DELETE FROM public.bank_transfer_journals
  WHERE id = j.id;

  DELETE FROM public.expenses
  WHERE id = j.expense_id;

  DELETE FROM public.income_transactions
  WHERE id = p_income_transaction_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: income-receipts (first path segment = organization_id)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('income-receipts', 'income-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "income_receipts_storage_select" ON storage.objects;
CREATE POLICY "income_receipts_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "income_receipts_storage_insert" ON storage.objects;
CREATE POLICY "income_receipts_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'income-receipts'
    AND (storage.foldername (name))[1] = (
      SELECT p.active_organization_id::text
      FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "income_receipts_storage_update" ON storage.objects;
CREATE POLICY "income_receipts_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'income-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "income_receipts_storage_delete" ON storage.objects;
CREATE POLICY "income_receipts_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Page access: Finance / Incomes (owner, admin, hr only by default)
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440020', NULL, '/incomes/dashboard', 'Incomes Dashboard', TRUE,
  ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/incomes/dashboard'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440021', NULL, '/incomes/transaction', 'Incomes Transactions', TRUE,
  ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/incomes/transaction'
);
