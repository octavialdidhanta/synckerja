-- Central inventory / stock management (shared pool across marketplaces).

CREATE TABLE IF NOT EXISTS public.inventory_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_org
  ON public.inventory_products (organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_skus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.inventory_products (id) ON DELETE CASCADE,
  internal_sku text NOT NULL,
  name text NOT NULL DEFAULT '',
  barcode text NULL,
  unit text NOT NULL DEFAULT 'pcs',
  variant_label text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_skus_org_internal_sku_key UNIQUE (organization_id, internal_sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_skus_org
  ON public.inventory_skus (organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_skus_product
  ON public.inventory_skus (product_id);

CREATE TABLE IF NOT EXISTS public.inventory_stock_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.inventory_skus (id) ON DELETE CASCADE,
  available_qty integer NOT NULL DEFAULT 0,
  reserved_qty integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stock_levels_sku_key UNIQUE (sku_id),
  CONSTRAINT inventory_stock_levels_available_nonneg CHECK (available_qty >= 0),
  CONSTRAINT inventory_stock_levels_reserved_nonneg CHECK (reserved_qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_levels_org
  ON public.inventory_stock_levels (organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.inventory_skus (id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  qty_delta integer NOT NULL,
  qty_after integer NOT NULL,
  platform text NULL,
  reference_type text NULL,
  reference_id text NULL,
  note text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_movements_org_sku
  ON public.inventory_stock_movements (organization_id, sku_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_platform_sku_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.inventory_skus (id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_product_id text NOT NULL DEFAULT '',
  platform_sku_id text NOT NULL DEFAULT '',
  seller_sku text NOT NULL DEFAULT '',
  shop_account_id text NULL,
  warehouse_id text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_platform_sku_mappings_unique
    UNIQUE (organization_id, platform, platform_sku_id, shop_account_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_platform_mappings_sku
  ON public.inventory_platform_sku_mappings (sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_platform_mappings_org_platform
  ON public.inventory_platform_sku_mappings (organization_id, platform);

CREATE TABLE IF NOT EXISTS public.inventory_sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.inventory_skus (id) ON DELETE CASCADE,
  target_platform text NOT NULL,
  target_qty integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sync_queue_pending
  ON public.inventory_sync_queue (status, scheduled_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS public.inventory_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.inventory_skus (id) ON DELETE CASCADE,
  platform text NOT NULL,
  target_qty integer NOT NULL,
  success boolean NOT NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sync_logs_org
  ON public.inventory_sync_logs (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_order_deductions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_order_id text NOT NULL,
  external_line_id text NOT NULL,
  sku_id uuid NULL REFERENCES public.inventory_skus (id) ON DELETE SET NULL,
  qty integer NOT NULL,
  movement_id uuid NULL REFERENCES public.inventory_stock_movements (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_order_deductions_idempotency
    UNIQUE (organization_id, platform, external_order_id, external_line_id)
);

-- RLS
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_platform_sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_order_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_products_select ON public.inventory_products;
CREATE POLICY inventory_products_select ON public.inventory_products
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS inventory_skus_select ON public.inventory_skus;
CREATE POLICY inventory_skus_select ON public.inventory_skus
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS inventory_stock_levels_select ON public.inventory_stock_levels;
CREATE POLICY inventory_stock_levels_select ON public.inventory_stock_levels
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS inventory_stock_movements_select ON public.inventory_stock_movements;
CREATE POLICY inventory_stock_movements_select ON public.inventory_stock_movements
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS inventory_platform_sku_mappings_select ON public.inventory_platform_sku_mappings;
CREATE POLICY inventory_platform_sku_mappings_select ON public.inventory_platform_sku_mappings
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS inventory_sync_logs_select ON public.inventory_sync_logs;
CREATE POLICY inventory_sync_logs_select ON public.inventory_sync_logs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Writes via edge functions (service role). Deny direct authenticated writes.
DROP POLICY IF EXISTS inventory_products_deny_insert ON public.inventory_products;
CREATE POLICY inventory_products_deny_insert ON public.inventory_products
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS inventory_products_deny_update ON public.inventory_products;
CREATE POLICY inventory_products_deny_update ON public.inventory_products
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS inventory_products_deny_delete ON public.inventory_products;
CREATE POLICY inventory_products_deny_delete ON public.inventory_products
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS inventory_skus_deny_write ON public.inventory_skus;
CREATE POLICY inventory_skus_deny_write ON public.inventory_skus
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY inventory_skus_deny_update ON public.inventory_skus
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY inventory_skus_deny_delete ON public.inventory_skus
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS inventory_sync_queue_deny ON public.inventory_sync_queue;
CREATE POLICY inventory_sync_queue_deny ON public.inventory_sync_queue
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS inventory_order_deductions_deny ON public.inventory_order_deductions;
CREATE POLICY inventory_order_deductions_deny ON public.inventory_order_deductions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.inventory_stock_levels IS
  'Shared pool available qty per SKU. Updated atomically via edge functions.';
