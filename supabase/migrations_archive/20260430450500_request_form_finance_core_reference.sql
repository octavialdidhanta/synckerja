-- Request Form + finance core (reference-aligned).
-- Runs after 20260430450000_company_module_core_reference (organizations, company_assets).
-- Creates: expense_types, expense_categories, bank balances, bank_accounts, debts,
--          purchase_requests, purchase_request_documents, storage bucket purchase-documents.
-- Later: 20260430450550 adds expenses + triggers; 202604305030+ ALTERs are idempotent if columns exist.

-- ---------------------------------------------------------------------------
-- bank_account_balances (required by initialize_bank_account_balance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_account_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  balance numeric(15, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_account_balances_bank_account_id_key UNIQUE (bank_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_account_balances_bank_account_id
  ON public.bank_account_balances (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_balances_organization_id
  ON public.bank_account_balances (organization_id);

COMMENT ON TABLE public.bank_account_balances IS 'Current balance per bank account (reference finance module).';

ALTER TABLE public.bank_account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_account_balances_org_select" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_org_select"
  ON public.bank_account_balances FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_balances_org_insert" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_org_insert"
  ON public.bank_account_balances FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_balances_org_update" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_org_update"
  ON public.bank_account_balances FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_balances_org_delete" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_org_delete"
  ON public.bank_account_balances FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public.update_bank_account_balances_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_bank_account_balances_updated_at ON public.bank_account_balances;
CREATE TRIGGER update_bank_account_balances_updated_at
  BEFORE UPDATE ON public.bank_account_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_account_balances_updated_at();

-- FK from balances -> bank_accounts added after bank_accounts exists (end of file).

-- ---------------------------------------------------------------------------
-- bank_account_balance_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_account_balance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense', 'manual_adjustment', 'initial')),
  transaction_id uuid,
  amount numeric(15, 2) NOT NULL,
  balance_before numeric(15, 2) NOT NULL,
  balance_after numeric(15, 2) NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_account_balance_history_bank_account_id
  ON public.bank_account_balance_history (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_balance_history_organization_id
  ON public.bank_account_balance_history (organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_balance_history_transaction_type
  ON public.bank_account_balance_history (transaction_type);
CREATE INDEX IF NOT EXISTS idx_bank_account_balance_history_created_at
  ON public.bank_account_balance_history (created_at DESC);

ALTER TABLE public.bank_account_balance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_account_balance_history_org_select" ON public.bank_account_balance_history;
CREATE POLICY "bank_account_balance_history_org_select"
  ON public.bank_account_balance_history FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_balance_history_org_insert" ON public.bank_account_balance_history;
CREATE POLICY "bank_account_balance_history_org_insert"
  ON public.bank_account_balance_history FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- expense_types
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_types (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  organization_id uuid NULL REFERENCES public.organizations (id),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_types_organization_id ON public.expense_types USING btree (organization_id);

DROP TRIGGER IF EXISTS update_expense_types_updated_at ON public.expense_types;
CREATE TRIGGER update_expense_types_updated_at
  BEFORE UPDATE ON public.expense_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_types_org_select" ON public.expense_types;
CREATE POLICY "expense_types_org_select"
  ON public.expense_types FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_types_org_insert" ON public.expense_types;
CREATE POLICY "expense_types_org_insert"
  ON public.expense_types FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_types_org_update" ON public.expense_types;
CREATE POLICY "expense_types_org_update"
  ON public.expense_types FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_types_org_delete" ON public.expense_types;
CREATE POLICY "expense_types_org_delete"
  ON public.expense_types FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- expense_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  expense_type_id uuid NULL REFERENCES public.expense_types (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_organization_id ON public.expense_categories USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_expense_type_id ON public.expense_categories USING btree (expense_type_id);

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_org_select" ON public.expense_categories;
CREATE POLICY "expense_categories_org_select"
  ON public.expense_categories FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_categories_org_insert" ON public.expense_categories;
CREATE POLICY "expense_categories_org_insert"
  ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_categories_org_update" ON public.expense_categories;
CREATE POLICY "expense_categories_org_update"
  ON public.expense_categories FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "expense_categories_org_delete" ON public.expense_categories;
CREATE POLICY "expense_categories_org_delete"
  ON public.expense_categories FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- bank_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  account_number text NULL,
  bank_name text NULL,
  account_holder text NULL,
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_organization_id ON public.bank_accounts USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON public.bank_accounts USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_name ON public.bank_accounts USING btree (name);

CREATE OR REPLACE FUNCTION public.update_bank_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_accounts_updated_at ();

-- FKs on ledger tables (balances + history) -> bank_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_account_balances_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.bank_account_balances
      ADD CONSTRAINT bank_account_balances_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_account_balance_history_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.bank_account_balance_history
      ADD CONSTRAINT bank_account_balance_history_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bank_account_balances (
    bank_account_id,
    organization_id,
    balance
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    0
  )
  ON CONFLICT (bank_account_id) DO NOTHING;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    'initial',
    0,
    0,
    0,
    'Initial balance',
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_bank_account_balance_trigger ON public.bank_accounts;
CREATE TRIGGER initialize_bank_account_balance_trigger
  AFTER INSERT ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.initialize_bank_account_balance ();

COMMENT ON FUNCTION public.initialize_bank_account_balance() IS 'Initializes bank_account_balances + first history row (reference).';

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_org_select" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_select"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_org_insert" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_insert"
  ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_org_update" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_update"
  ON public.bank_accounts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_org_delete" ON public.bank_accounts;
CREATE POLICY "bank_accounts_org_delete"
  ON public.bank_accounts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- debts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  debt_name text NOT NULL,
  debt_type text NOT NULL,
  bank_name text NULL,
  limit_amount numeric(15, 2) NULL DEFAULT 0,
  debt_amount numeric(15, 2) NULL DEFAULT 0,
  interest_rate numeric(5, 2) NULL,
  due_date date NULL,
  minimum_payment numeric(15, 2) NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  available_limit numeric(15, 2) NULL,
  paid_amount numeric(15, 2) NULL DEFAULT 0,
  loan_duration integer NULL,
  monthly_payment numeric(15, 2) NULL,
  remaining_debt numeric(15, 2) NULL DEFAULT 0,
  CONSTRAINT debts_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'paid_off'::text, 'closed'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_debts_organization_id ON public.debts USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_debts_created_by ON public.debts USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_debts_debt_type ON public.debts USING btree (debt_type);
CREATE INDEX IF NOT EXISTS idx_debts_created_at ON public.debts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debts_remaining_debt ON public.debts USING btree (remaining_debt);

DROP TRIGGER IF EXISTS update_debts_updated_at ON public.debts;
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debts_org_select" ON public.debts;
CREATE POLICY "debts_org_select"
  ON public.debts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debts_org_insert" ON public.debts;
CREATE POLICY "debts_org_insert"
  ON public.debts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debts_org_update" ON public.debts;
CREATE POLICY "debts_org_update"
  ON public.debts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "debts_org_delete" ON public.debts;
CREATE POLICY "debts_org_delete"
  ON public.debts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- purchase_requests (reference DDL; includes quantity + payment columns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  department_name text NULL,
  purchase_type text NULL,
  request_title text NOT NULL,
  amount_idr numeric NOT NULL,
  is_recurring boolean NULL DEFAULT false,
  recurring_frequency text NULL,
  description text NOT NULL,
  company_benefit text NOT NULL,
  productivity_impact text NULL,
  efficiency_impact text NULL,
  expected_outcome text NULL,
  vendor_name text NULL,
  purchase_link text NULL,
  account_username text NULL,
  account_password text NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  submitted_at timestamptz NULL,
  approved_at timestamptz NULL,
  approved_by uuid NULL,
  rejected_at timestamptz NULL,
  rejected_by uuid NULL,
  rejection_reason text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expense_type_id uuid NULL REFERENCES public.expense_types (id),
  expense_category_id uuid NULL REFERENCES public.expense_categories (id),
  approval_notes text NULL,
  approved_by_name text NULL,
  rejected_by_name text NULL,
  approved_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  rejected_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  paid_at timestamptz NULL,
  payment_status text NULL DEFAULT 'pending'::text,
  business_purpose text NULL,
  exchange_rate text NULL,
  expense_date timestamptz NULL,
  merchant_name text NULL,
  original_receipt_amount text NULL,
  receipt_number text NULL,
  reimbursement_type text NULL,
  request_type text NULL,
  bank_account_number text NULL,
  bank_account_name text NULL,
  bank_name text NULL,
  invoice_file_path text NULL,
  paid_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  paid_by_name text NULL,
  withdrawal_from_balance uuid NULL REFERENCES public.debts (id) ON DELETE SET NULL,
  bank_account_id uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  CONSTRAINT purchase_requests_status_check CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'submitted'::text,
        'pending_approval'::text,
        'approved'::text,
        'rejected'::text,
        'cancelled'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_expense_type_id ON public.purchase_requests USING btree (expense_type_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_expense_category_id ON public.purchase_requests USING btree (expense_category_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_approved_by_user_id ON public.purchase_requests USING btree (approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_rejected_by_user_id ON public.purchase_requests USING btree (rejected_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_paid_at ON public.purchase_requests USING btree (paid_at);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_payment_status ON public.purchase_requests USING btree (payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_request_type ON public.purchase_requests USING btree (request_type);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_organization_id ON public.purchase_requests USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester_id ON public.purchase_requests USING btree (requester_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_withdrawal_from_balance
  ON public.purchase_requests USING btree (withdrawal_from_balance)
  WHERE (withdrawal_from_balance IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_bank_account_id
  ON public.purchase_requests USING btree (bank_account_id)
  WHERE (bank_account_id IS NOT NULL);

DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON public.purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_requests_org_select" ON public.purchase_requests;
CREATE POLICY "purchase_requests_org_select"
  ON public.purchase_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "purchase_requests_org_insert" ON public.purchase_requests;
CREATE POLICY "purchase_requests_org_insert"
  ON public.purchase_requests FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "purchase_requests_org_update" ON public.purchase_requests;
CREATE POLICY "purchase_requests_org_update"
  ON public.purchase_requests FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "purchase_requests_org_delete" ON public.purchase_requests;
CREATE POLICY "purchase_requests_org_delete"
  ON public.purchase_requests FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON COLUMN public.purchase_requests.quantity IS 'Physical units for Physical Item requests.';
COMMENT ON COLUMN public.purchase_requests.paid_by_user_id IS 'User who processed payment (invoice upload).';
COMMENT ON COLUMN public.purchase_requests.withdrawal_from_balance IS 'Debt funding source at approval/payment-process.';
COMMENT ON COLUMN public.purchase_requests.bank_account_id IS 'Bank account funding source at approval/payment-process.';

-- ---------------------------------------------------------------------------
-- purchase_request_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_request_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  purchase_request_id uuid NOT NULL REFERENCES public.purchase_requests (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_at timestamptz NULL DEFAULT now(),
  uploaded_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchase_request_documents_purchase_request_id
  ON public.purchase_request_documents (purchase_request_id);

ALTER TABLE public.purchase_request_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_request_documents_select" ON public.purchase_request_documents;
CREATE POLICY "purchase_request_documents_select"
  ON public.purchase_request_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_documents.purchase_request_id
        AND pr.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "purchase_request_documents_insert" ON public.purchase_request_documents;
CREATE POLICY "purchase_request_documents_insert"
  ON public.purchase_request_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_documents.purchase_request_id
        AND pr.organization_id IN (SELECT public.user_organization_ids())
    )
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "purchase_request_documents_delete" ON public.purchase_request_documents;
CREATE POLICY "purchase_request_documents_delete"
  ON public.purchase_request_documents FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_documents.purchase_request_id
        AND pr.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: purchase-documents (path: {organization_id}/... — matches app upload)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-documents', 'purchase-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "purchase_documents_storage_select" ON storage.objects;
CREATE POLICY "purchase_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "purchase_documents_storage_insert" ON storage.objects;
CREATE POLICY "purchase_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'purchase-documents'
    AND (storage.foldername (name))[1] = (
      SELECT p.active_organization_id::text
      FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "purchase_documents_storage_update" ON storage.objects;
CREATE POLICY "purchase_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'purchase-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "purchase_documents_storage_delete" ON storage.objects;
CREATE POLICY "purchase_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );
