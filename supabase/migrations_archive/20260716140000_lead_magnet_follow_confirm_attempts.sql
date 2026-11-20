ALTER TABLE lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS follow_confirm_attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN lead_magnet_enrollments.follow_confirm_attempts IS
  'Facebook two-step follow gate: 0 = first Sudah Follow click (nudge only), >=1 = allow material offer.';
