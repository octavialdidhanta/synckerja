-- Gateway payout bank: Iluma name validation columns, audit log, anti-bypass triggers.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS gateway_payout_validation_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS gateway_payout_validated_holder text NULL,
  ADD COLUMN IF NOT EXISTS gateway_payout_validation_id text NULL,
  ADD COLUMN IF NOT EXISTS gateway_payout_validated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS gateway_payout_validation_fingerprint text NULL,
  ADD COLUMN IF NOT EXISTS gateway_payout_is_normal_account boolean NULL,
  ADD COLUMN IF NOT EXISTS gateway_payout_validation_error text NULL;

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_gateway_payout_validation_status_check;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_gateway_payout_validation_status_check CHECK (
    gateway_payout_validation_status IN (
      'none', 'pending', 'match', 'not_match', 'unclear', 'failed', 'error', 'stale'
    )
  );

COMMENT ON COLUMN public.bank_accounts.gateway_payout_validation_status IS
  'Iluma bank name validation: only match allows gateway payout withdrawal.';

CREATE TABLE IF NOT EXISTS public.gateway_payout_bank_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE CASCADE,
  iluma_request_id text NULL,
  bank_code text NOT NULL,
  account_number text NOT NULL,
  given_name text NOT NULL,
  status text NOT NULL,
  name_matching_result text NULL,
  failure_reason text NULL,
  is_normal_account boolean NULL,
  raw_response jsonb NULL,
  initiated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_gateway_payout_bank_validations_org
  ON public.gateway_payout_bank_validations (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gateway_payout_bank_validations_bank
  ON public.gateway_payout_bank_validations (bank_account_id, created_at DESC);

ALTER TABLE public.gateway_payout_bank_validations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gateway_payout_bank_fingerprint(
  p_bank_code text,
  p_account_number text,
  p_account_holder text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    sha256(
      convert_to(
        lower(trim(coalesce(p_bank_code, ''))) || '|' ||
        regexp_replace(coalesce(p_account_number, ''), '[^0-9]', '', 'g') || '|' ||
        upper(trim(coalesce(p_account_holder, ''))),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_gateway_payout_validation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_fp text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.use_for_gateway_payout IS TRUE
      OR OLD.use_for_gateway_payout IS TRUE
    ) AND (
      coalesce(NEW.account_number, '') IS DISTINCT FROM coalesce(OLD.account_number, '')
      OR coalesce(NEW.account_holder, '') IS DISTINCT FROM coalesce(OLD.account_holder, '')
      OR coalesce(NEW.gateway_payout_bank_code, '') IS DISTINCT FROM coalesce(OLD.gateway_payout_bank_code, '')
    ) THEN
      NEW.gateway_payout_validation_status := 'stale';
      NEW.use_for_gateway_payout := false;
      NEW.gateway_payout_validated_at := NULL;
      NEW.gateway_payout_validation_fingerprint := NULL;
      NEW.gateway_payout_validated_holder := NULL;
      NEW.gateway_payout_validation_id := NULL;
      NEW.gateway_payout_is_normal_account := NULL;
    END IF;
  END IF;

  IF NEW.use_for_gateway_payout IS TRUE THEN
    IF NEW.gateway_payout_validation_status IS DISTINCT FROM 'match' THEN
      RAISE EXCEPTION 'gateway_payout_not_validated';
    END IF;

    v_fp := public.gateway_payout_bank_fingerprint(
      NEW.gateway_payout_bank_code,
      NEW.account_number,
      NEW.account_holder
    );

    IF NEW.gateway_payout_validation_fingerprint IS NULL
      OR NEW.gateway_payout_validation_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'gateway_payout_fingerprint_mismatch';
    END IF;

    IF NEW.gateway_payout_is_normal_account IS NOT TRUE THEN
      RAISE EXCEPTION 'gateway_payout_not_normal_account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_gateway_payout_validation ON public.bank_accounts;

CREATE TRIGGER trg_enforce_gateway_payout_validation
  BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gateway_payout_validation();

-- Existing payout rows must re-validate before withdrawal.
UPDATE public.bank_accounts
SET
  use_for_gateway_payout = false,
  gateway_payout_validation_status = 'stale',
  gateway_payout_validated_at = NULL,
  gateway_payout_validation_fingerprint = NULL,
  gateway_payout_validated_holder = NULL,
  gateway_payout_validation_id = NULL,
  gateway_payout_is_normal_account = NULL,
  gateway_payout_validation_error = 'Re-validation required after Iluma integration'
WHERE use_for_gateway_payout IS TRUE
   OR gateway_payout_bank_code IS NOT NULL;
