-- Store receipt: persist optional cash received so View receipt can show change.

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS cash_tendered numeric NULL;

ALTER TABLE public.sales_activities
  DROP CONSTRAINT IF EXISTS sales_activities_cash_tendered_check;

ALTER TABLE public.sales_activities
  ADD CONSTRAINT sales_activities_cash_tendered_check CHECK (
    cash_tendered IS NULL OR cash_tendered >= 0
  );

COMMENT ON COLUMN public.sales_activities.cash_tendered IS
  'Optional cash received at store checkout. Change is total subtracted in the UI; not used by income RPC.';
