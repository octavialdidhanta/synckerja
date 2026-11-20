ALTER TABLE public.passwords
  DROP COLUMN IF EXISTS password;

REVOKE INSERT (password_ciphertext), UPDATE (password_ciphertext)
  ON TABLE public.passwords
  FROM PUBLIC, anon, authenticated;
