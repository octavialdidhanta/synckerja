-- Gateway payout (Xendit xenPlatform): single bank_accounts row per org, no duplicate on organization_xendit_accounts.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS use_for_gateway_payout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gateway_payout_bank_code text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_one_gateway_payout_per_org
  ON public.bank_accounts (organization_id)
  WHERE use_for_gateway_payout = true;

COMMENT ON COLUMN public.bank_accounts.use_for_gateway_payout IS
  'When true, this ERP bank account is the Xendit xenPlatform payout / withdrawal account for the organization.';
COMMENT ON COLUMN public.bank_accounts.gateway_payout_bank_code IS
  'Xendit disbursement bank code (e.g. BCA, MANDIRI) when use_for_gateway_payout is true.';

-- Backfill from legacy organization_xendit_accounts payout columns into bank_accounts.
DO $$
DECLARE
  rec RECORD;
  new_bank_id uuid;
  bank_display text;
BEGIN
  FOR rec IN
    SELECT
      oxa.organization_id,
      oxa.linked_bank_account_id,
      oxa.payout_bank_code,
      oxa.payout_account_number,
      oxa.payout_account_holder_name,
      oxa.business_name
    FROM public.organization_xendit_accounts oxa
    WHERE oxa.payout_bank_code IS NOT NULL
      AND oxa.payout_account_number IS NOT NULL
      AND oxa.payout_account_holder_name IS NOT NULL
  LOOP
    UPDATE public.bank_accounts
    SET use_for_gateway_payout = false
    WHERE organization_id = rec.organization_id;

    bank_display := COALESCE(NULLIF(TRIM(rec.payout_bank_code), ''), 'Bank');

    IF rec.linked_bank_account_id IS NOT NULL THEN
      UPDATE public.bank_accounts
      SET
        use_for_gateway_payout = true,
        gateway_payout_bank_code = rec.payout_bank_code,
        account_number = COALESCE(NULLIF(TRIM(account_number), ''), rec.payout_account_number),
        account_holder = COALESCE(NULLIF(TRIM(account_holder), ''), rec.payout_account_holder_name),
        bank_name = COALESCE(NULLIF(TRIM(bank_name), ''), bank_display),
        updated_at = now()
      WHERE id = rec.linked_bank_account_id
        AND organization_id = rec.organization_id;

      UPDATE public.organization_xendit_accounts
      SET linked_bank_account_id = rec.linked_bank_account_id, updated_at = now()
      WHERE organization_id = rec.organization_id;
    ELSE
      INSERT INTO public.bank_accounts (
        organization_id,
        name,
        bank_name,
        account_number,
        account_holder,
        gateway_payout_bank_code,
        use_for_gateway_payout,
        is_active
      )
      VALUES (
        rec.organization_id,
        COALESCE(NULLIF(TRIM(rec.business_name), ''), 'Organization') || ' - Gateway payout',
        bank_display,
        rec.payout_account_number,
        rec.payout_account_holder_name,
        rec.payout_bank_code,
        true,
        true
      )
      RETURNING id INTO new_bank_id;

      UPDATE public.organization_xendit_accounts
      SET linked_bank_account_id = new_bank_id, updated_at = now()
      WHERE organization_id = rec.organization_id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.organization_xendit_accounts
  DROP COLUMN IF EXISTS payout_bank_code,
  DROP COLUMN IF EXISTS payout_account_number,
  DROP COLUMN IF EXISTS payout_account_holder_name;
