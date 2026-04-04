-- Keywords per organization + service (Product Knowledge / digital marketing).
-- Prerequisites: public.profiles, public.organizations, public.services,
--                public.user_organization_ids().

-- Same behavior as public.update_updated_at_column(); dedicated name for your trigger.
CREATE OR REPLACE FUNCTION public.update_keywords_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  service_id uuid NULL,
  keyword text NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT keywords_pkey PRIMARY KEY (id),
  CONSTRAINT keywords_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT keywords_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT keywords_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services (id) ON DELETE CASCADE,
  CONSTRAINT keywords_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_keywords_organization_id ON public.keywords USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_keywords_service_id ON public.keywords USING btree (service_id);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON public.keywords USING btree (keyword);

DROP TRIGGER IF EXISTS update_keywords_updated_at ON public.keywords;
CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON public.keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_keywords_updated_at();

ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "keywords_org" ON public.keywords;
CREATE POLICY "keywords_org" ON public.keywords
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
