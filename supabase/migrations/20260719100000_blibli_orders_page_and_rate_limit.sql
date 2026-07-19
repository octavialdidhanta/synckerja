-- Blibli Order Management: rate-limit audit + page permission

CREATE TABLE IF NOT EXISTS public.blibli_seller_order_api_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.organization_blibli_seller_connections (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'listPackages',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blibli_seller_order_api_calls IS
  'Audit of Blibli order package filter API calls for ~100/30min per store rate limit.';

CREATE INDEX IF NOT EXISTS idx_blibli_seller_order_api_calls_conn_created
  ON public.blibli_seller_order_api_calls (connection_id, created_at DESC);

ALTER TABLE public.blibli_seller_order_api_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blibli_seller_order_api_calls_deny
  ON public.blibli_seller_order_api_calls;
CREATE POLICY blibli_seller_order_api_calls_deny
  ON public.blibli_seller_order_api_calls
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Page permission: Operations — Blibli Orders
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES (
  '/operations/sales/blibli-orders',
  'Operations — Sales — Blibli Orders',
  true,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/operations/sales/blibli-orders'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
