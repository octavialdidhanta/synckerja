-- Security hardening: make search_path immutable for update_pricing_templates_updated_at
-- Fixes "Function Search Path Mutable" warning from Postgres/Supabase.

CREATE OR REPLACE FUNCTION public.update_pricing_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

