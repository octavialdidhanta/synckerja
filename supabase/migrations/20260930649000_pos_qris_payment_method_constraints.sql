-- Allow QRIS as a valid payment_method on sales tables (pos_finalize_qris_checkout / settlement).

ALTER TABLE public.sales_activities
  DROP CONSTRAINT IF EXISTS sales_activities_payment_method_check;

ALTER TABLE public.sales_activities
  ADD CONSTRAINT sales_activities_payment_method_check CHECK (
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
        'qris'::text,
        'other'::text
      ]
    )
  );

ALTER TABLE public.sales_payments
  DROP CONSTRAINT IF EXISTS sales_payments_payment_method_check;

ALTER TABLE public.sales_payments
  ADD CONSTRAINT sales_payments_payment_method_check CHECK (
    payment_method = ANY (
      ARRAY[
        'cash'::text,
        'bank_transfer'::text,
        'credit_card'::text,
        'e_wallet'::text,
        'qris'::text,
        'other'::text
      ]
    )
  );

ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_deposit_source_check;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_deposit_source_check CHECK (
    deposit_source IS NULL
    OR deposit_source = ANY (
      ARRAY[
        'manual_verification'::text,
        'xendit_va'::text,
        'xendit_qris'::text,
        'manual_admin'::text,
        'brick_mutasi'::text,
        'brick_va'::text,
        'store_checkout'::text
      ]
    )
  );

COMMENT ON COLUMN public.income_transactions.deposit_source IS
  'manual_verification | xendit_va | xendit_qris | manual_admin | brick_mutasi | brick_va | store_checkout';
