-- Sales activities stack (synckerja-reference aligned).
-- Fixes PGRST205: missing public.sales_activities for REST / app hooks (sales.ts).
--
-- Prerequisites: public.organizations, auth.users, public.services, public.sub_services,
--   public.income_types, public.income_categories, public.leads (CRM core / income module).
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE functions, DROP TRIGGER IF EXISTS.

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_sales_activities_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_activities_is_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.total_amount, 0) > 0
     AND COALESCE(NEW.total_paid_amount, 0) >= NEW.total_amount THEN
    NEW.is_paid := TRUE;
  ELSE
    NEW.is_paid := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_activities_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.total_amount, 0) <= 0 THEN
    NEW.payment_status := COALESCE(NEW.payment_status, 'unpaid');
  ELSIF COALESCE(NEW.total_paid_amount, 0) >= NEW.total_amount THEN
    NEW.payment_status := 'paid';
  ELSIF COALESCE(NEW.total_paid_amount, 0) > 0 THEN
    NEW.payment_status := 'partial';
  ELSE
    NEW.payment_status := 'unpaid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_item_total_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.total_price := COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_price, 0);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_activity_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.sales_activity_id;
  ELSE
    target_id := NEW.sales_activity_id;
  END IF;

  UPDATE public.sales_activities sa
  SET
    total_amount = COALESCE((
      SELECT SUM(i.total_price)
      FROM public.sales_activity_items i
      WHERE i.sales_activity_id = sa.id
    ), 0),
    updated_at = NOW()
  WHERE sa.id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payment_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(p.payment_sequence), 0) + 1
  INTO NEW.payment_sequence
  FROM public.sales_activity_payments p
  WHERE p.sales_activity_id = NEW.sales_activity_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_activity_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  sum_paid numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.sales_activity_id;
  ELSE
    target_id := NEW.sales_activity_id;
  END IF;

  SELECT COALESCE(SUM(payment_amount), 0) INTO sum_paid
  FROM public.sales_activity_payments
  WHERE sales_activity_id = target_id;

  UPDATE public.sales_activities sa
  SET
    total_paid_amount = sum_paid,
    updated_at = NOW()
  WHERE sa.id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_targets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- sales_activities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations (id),
  client_name text NOT NULL,
  client_phone text NULL,
  activity_type text NOT NULL,
  status text NOT NULL DEFAULT 'Active'::text,
  service_id uuid NULL REFERENCES public.services (id),
  sub_service_id uuid NULL REFERENCES public.sub_services (id),
  income_type_id uuid NULL REFERENCES public.income_types (id),
  income_category_id uuid NULL REFERENCES public.income_categories (id),
  amount numeric NULL DEFAULT 0,
  total_amount numeric NULL,
  down_payment_amount numeric NULL,
  remaining_amount numeric NULL,
  is_down_payment boolean NULL DEFAULT false,
  date date NOT NULL,
  description text NULL,
  is_paid boolean NULL DEFAULT false,
  payment_method text NULL,
  receipt_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id),
  follow_up_date timestamptz NULL,
  notes text NULL,
  client_email text NULL,
  total_paid_amount numeric NULL DEFAULT 0,
  payment_status text NULL DEFAULT 'unpaid'::text,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  CONSTRAINT sales_activities_pkey PRIMARY KEY (id),
  CONSTRAINT sales_activities_payment_method_check CHECK (
    payment_method IS NULL
    OR lower(payment_method) = ANY (
      ARRAY[
        'cash'::text,
        'transfer'::text,
        'credit'::text,
        'pending'::text,
        'bank_transfer'::text,
        'credit_card'::text,
        'e_wallet'::text,
        'other'::text
      ]
    )
  ),
  CONSTRAINT sales_activities_activity_type_check CHECK (
    activity_type = ANY (
      ARRAY[
        'Demo'::text,
        'Meeting'::text,
        'Call'::text,
        'Proposal'::text,
        'Closing'::text,
        'visit'::text,
        'Lead Conversion'::text
      ]
    )
  ),
  CONSTRAINT sales_activities_payment_status_check CHECK (
    payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text])
  ),
  CONSTRAINT sales_activities_status_check CHECK (
    status = ANY (
      ARRAY[
        'Active'::text,
        'Negotiating'::text,
        'Won'::text,
        'Lost'::text,
        'Follow Up'::text,
        'Converted'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_sales_activities_organization_id ON public.sales_activities USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_lead_id ON public.sales_activities USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created_at ON public.sales_activities USING btree (created_at DESC);

ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activities_org_select" ON public.sales_activities;
CREATE POLICY "sales_activities_org_select"
  ON public.sales_activities FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_activities_org_insert" ON public.sales_activities;
CREATE POLICY "sales_activities_org_insert"
  ON public.sales_activities FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_activities_org_update" ON public.sales_activities;
CREATE POLICY "sales_activities_org_update"
  ON public.sales_activities FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_activities_org_delete" ON public.sales_activities;
CREATE POLICY "sales_activities_org_delete"
  ON public.sales_activities FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP TRIGGER IF EXISTS update_sales_activities_updated_at ON public.sales_activities;
CREATE TRIGGER update_sales_activities_updated_at
  BEFORE UPDATE ON public.sales_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_activities_updated_at();

DROP TRIGGER IF EXISTS trg_sales_activities_update_is_paid ON public.sales_activities;
CREATE TRIGGER trg_sales_activities_update_is_paid
  BEFORE INSERT OR UPDATE ON public.sales_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_activities_is_paid();

DROP TRIGGER IF EXISTS trg_sales_activities_update_payment_status ON public.sales_activities;
CREATE TRIGGER trg_sales_activities_update_payment_status
  BEFORE INSERT OR UPDATE ON public.sales_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_activities_payment_status();

-- ---------------------------------------------------------------------------
-- sales_activity_items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_activity_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services (id),
  sub_service_id uuid NULL REFERENCES public.sub_services (id),
  service_name text NOT NULL,
  sub_service_name text NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sales_activity_items_sales_activity_id ON public.sales_activity_items USING btree (sales_activity_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_items_organization_id ON public.sales_activity_items USING btree (organization_id);

ALTER TABLE public.sales_activity_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_items_org_select" ON public.sales_activity_items;
CREATE POLICY "sales_activity_items_org_select"
  ON public.sales_activity_items FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_items_org_insert" ON public.sales_activity_items;
CREATE POLICY "sales_activity_items_org_insert"
  ON public.sales_activity_items FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_items_org_update" ON public.sales_activity_items;
CREATE POLICY "sales_activity_items_org_update"
  ON public.sales_activity_items FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_items_org_delete" ON public.sales_activity_items;
CREATE POLICY "sales_activity_items_org_delete"
  ON public.sales_activity_items FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS calculate_item_total_price_trigger ON public.sales_activity_items;
CREATE TRIGGER calculate_item_total_price_trigger
  BEFORE INSERT OR UPDATE ON public.sales_activity_items
  FOR EACH ROW EXECUTE FUNCTION public.calculate_item_total_price();

DROP TRIGGER IF EXISTS update_sales_activity_items_updated_at ON public.sales_activity_items;
CREATE TRIGGER update_sales_activity_items_updated_at
  BEFORE UPDATE ON public.sales_activity_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_activity_total_trigger ON public.sales_activity_items;
CREATE TRIGGER update_sales_activity_total_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.sales_activity_items
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_activity_total_amount();

-- ---------------------------------------------------------------------------
-- sales_activity_payments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_activity_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  payment_amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash'::text,
  payment_type text NOT NULL DEFAULT 'down_payment'::text,
  payment_sequence integer NOT NULL DEFAULT 1,
  notes text NULL,
  receipt_url text NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_payments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sales_activity_payments_sales_activity_id ON public.sales_activity_payments USING btree (sales_activity_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_payments_organization_id ON public.sales_activity_payments USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_payments_payment_date ON public.sales_activity_payments USING btree (payment_date);

ALTER TABLE public.sales_activity_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_payments_org_select" ON public.sales_activity_payments;
CREATE POLICY "sales_activity_payments_org_select"
  ON public.sales_activity_payments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_payments_org_insert" ON public.sales_activity_payments;
CREATE POLICY "sales_activity_payments_org_insert"
  ON public.sales_activity_payments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_payments_org_update" ON public.sales_activity_payments;
CREATE POLICY "sales_activity_payments_org_update"
  ON public.sales_activity_payments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_payments_org_delete" ON public.sales_activity_payments;
CREATE POLICY "sales_activity_payments_org_delete"
  ON public.sales_activity_payments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS set_payment_sequence_trigger ON public.sales_activity_payments;
CREATE TRIGGER set_payment_sequence_trigger
  BEFORE INSERT ON public.sales_activity_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_sequence();

DROP TRIGGER IF EXISTS trg_sales_activity_payments_update_totals ON public.sales_activity_payments;
CREATE TRIGGER trg_sales_activity_payments_update_totals
  AFTER INSERT OR DELETE OR UPDATE ON public.sales_activity_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_activity_payment_totals();

DROP TRIGGER IF EXISTS update_sales_activity_payments_updated_at ON public.sales_activity_payments;
CREATE TRIGGER update_sales_activity_payments_updated_at
  BEFORE UPDATE ON public.sales_activity_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- sales_payments (legacy/simple payment rows)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_date date NOT NULL,
  receipt_url text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id),
  CONSTRAINT sales_payments_pkey PRIMARY KEY (id),
  CONSTRAINT sales_payments_payment_method_check CHECK (
    payment_method = ANY (
      ARRAY[
        'cash'::text,
        'bank_transfer'::text,
        'credit_card'::text,
        'e_wallet'::text,
        'other'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_sales_payments_sales_activity_id ON public.sales_payments USING btree (sales_activity_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_organization_id ON public.sales_payments USING btree (organization_id);

ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_payments_org_select" ON public.sales_payments;
CREATE POLICY "sales_payments_org_select"
  ON public.sales_payments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_payments_org_insert" ON public.sales_payments;
CREATE POLICY "sales_payments_org_insert"
  ON public.sales_payments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_payments_org_update" ON public.sales_payments;
CREATE POLICY "sales_payments_org_update"
  ON public.sales_payments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_payments_org_delete" ON public.sales_payments;
CREATE POLICY "sales_payments_org_delete"
  ON public.sales_payments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- sales_channels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  commission_percent numeric(5, 2) NULL DEFAULT 0,
  payment_fee_percent numeric(5, 2) NULL DEFAULT 0,
  ad_spend_percent numeric(5, 2) NULL DEFAULT 0,
  other_fee_percent numeric(5, 2) NULL DEFAULT 0,
  total_fee_percent numeric(5, 2) NOT NULL,
  is_active boolean NULL DEFAULT true,
  is_default boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT sales_channels_pkey PRIMARY KEY (id),
  CONSTRAINT sales_channels_organization_id_name_key UNIQUE (organization_id, name),
  CONSTRAINT sales_channels_type_check CHECK (type = ANY (ARRAY['online'::text, 'offline'::text]))
);

CREATE INDEX IF NOT EXISTS idx_sales_channels_organization_id ON public.sales_channels USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_type ON public.sales_channels USING btree (type);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_active ON public.sales_channels USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_default ON public.sales_channels USING btree (is_default);

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

-- Avoid multiple permissive policies (173 pricing_tools_sc_* + this file): keep org-scoped sales_channels_org_* only.
DROP POLICY IF EXISTS "pricing_tools_sc_select" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_insert" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_update" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_delete" ON public.sales_channels;

DROP POLICY IF EXISTS "sales_channels_org_select" ON public.sales_channels;
CREATE POLICY "sales_channels_org_select"
  ON public.sales_channels FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_channels_org_insert" ON public.sales_channels;
CREATE POLICY "sales_channels_org_insert"
  ON public.sales_channels FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_channels_org_update" ON public.sales_channels;
CREATE POLICY "sales_channels_org_update"
  ON public.sales_channels FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "sales_channels_org_delete" ON public.sales_channels;
CREATE POLICY "sales_channels_org_delete"
  ON public.sales_channels FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP TRIGGER IF EXISTS update_sales_channels_updated_at ON public.sales_channels;
CREATE TRIGGER update_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- sales_targets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  target_name text NOT NULL,
  description text NULL,
  target_amount numeric(15, 2) NOT NULL,
  current_value numeric(15, 2) NULL DEFAULT 0,
  progress_percentage numeric(5, 2) NULL DEFAULT 0,
  service_id uuid NULL REFERENCES public.services (id) ON DELETE SET NULL,
  sub_service_id uuid NULL REFERENCES public.sub_services (id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NULL DEFAULT 'active'::text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_targets_pkey PRIMARY KEY (id),
  CONSTRAINT sales_targets_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'completed'::text, 'overdue'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_organization_id ON public.sales_targets USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_created_by ON public.sales_targets USING btree (created_by);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_targets_org_select" ON public.sales_targets;
CREATE POLICY "sales_targets_org_select"
  ON public.sales_targets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_targets_org_insert" ON public.sales_targets;
CREATE POLICY "sales_targets_org_insert"
  ON public.sales_targets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_targets_org_update" ON public.sales_targets;
CREATE POLICY "sales_targets_org_update"
  ON public.sales_targets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_targets_org_delete" ON public.sales_targets;
CREATE POLICY "sales_targets_org_delete"
  ON public.sales_targets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS sales_targets_updated_at ON public.sales_targets;
CREATE TRIGGER sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_targets_updated_at();
