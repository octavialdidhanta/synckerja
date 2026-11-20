REVOKE INSERT, UPDATE ON TABLE public.passwords FROM PUBLIC, anon, authenticated;

GRANT UPDATE (is_favorite, updated_at)
  ON TABLE public.passwords
  TO authenticated;
