-- Funding source: Xendit / Brick gateway wallet (synced via organization_gateway_wallets).

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS gateway_wallet_provider text NULL;

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS gateway_wallet_provider text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_gateway_wallet_provider_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_gateway_wallet_provider_check CHECK (
        gateway_wallet_provider IS NULL
        OR gateway_wallet_provider = ANY (ARRAY['brick'::text, 'xendit'::text])
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_gateway_wallet_provider_check'
  ) THEN
    ALTER TABLE public.purchase_requests
      ADD CONSTRAINT purchase_requests_gateway_wallet_provider_check CHECK (
        gateway_wallet_provider IS NULL
        OR gateway_wallet_provider = ANY (ARRAY['brick'::text, 'xendit'::text])
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_gateway_wallet_provider
  ON public.expenses (gateway_wallet_provider)
  WHERE gateway_wallet_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_gateway_wallet_provider
  ON public.purchase_requests (gateway_wallet_provider)
  WHERE gateway_wallet_provider IS NOT NULL;

COMMENT ON COLUMN public.expenses.gateway_wallet_provider IS
  'When set, expense is funded from Brick or Xendit gateway wallet snapshot (not bank_account_id / debt).';

COMMENT ON COLUMN public.purchase_requests.gateway_wallet_provider IS
  'Preferred gateway wallet funding source at approval or payment-process.';

CREATE OR REPLACE FUNCTION public.handle_expense_gateway_wallet_debit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usable numeric;
BEGIN
  IF NEW.gateway_wallet_provider IS NULL OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT usable_balance INTO v_usable
  FROM public.organization_gateway_wallets
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gateway wallet not configured for provider %', NEW.gateway_wallet_provider;
  END IF;

  IF v_usable < NEW.amount THEN
    RAISE EXCEPTION 'Insufficient gateway wallet balance (provider %, available %, required %)',
      NEW.gateway_wallet_provider, v_usable, NEW.amount;
  END IF;

  UPDATE public.organization_gateway_wallets
  SET
    usable_balance = usable_balance - NEW.amount,
    total_balance = GREATEST(0, total_balance - NEW.amount),
    updated_at = now()
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_gateway_wallet_debit ON public.expenses;
CREATE TRIGGER expense_gateway_wallet_debit
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_gateway_wallet_debit();
