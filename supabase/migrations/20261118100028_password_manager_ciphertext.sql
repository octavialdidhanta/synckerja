ALTER TABLE public.passwords
  ADD COLUMN IF NOT EXISTS password_ciphertext text,
  ADD COLUMN IF NOT EXISTS password_strength text;

ALTER TABLE public.passwords
  DROP CONSTRAINT IF EXISTS passwords_password_strength_check;

ALTER TABLE public.passwords
  ADD CONSTRAINT passwords_password_strength_check
  CHECK (
    password_strength IS NULL
    OR password_strength IN ('weak', 'medium', 'strong')
  );
