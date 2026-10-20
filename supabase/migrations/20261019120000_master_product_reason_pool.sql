ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS product_reason_pool jsonb;

COMMENT ON COLUMN public.thinking_master_thoughts.product_reason_pool IS
  'Frozen product advantages, solutions, and features. Null means Big Thoughts may use a general because-clause.';
