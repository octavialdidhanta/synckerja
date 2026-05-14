-- Idempotency: HR checkout that includes bundled omnichannel roster units in `prorate_details`.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bundled_omnichannel_units_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payments.bundled_omnichannel_units_applied IS
  'When true, process-midtrans-payment has applied prorate_details.bundled_omnichannel_roster_units to organization_subscriptions.omnichannel_paid_seat_count.';
