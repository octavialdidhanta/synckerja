-- Client visits (sales / operations scheduling).
-- Fixes PGRST205 / 404 for REST: public.client_visits (useVisitScheduling, useClientVisits in sales.ts).
--
-- Prerequisites: public.organizations, public.clients, public.employees, public.office_locations
-- Safe to re-run: IF NOT EXISTS, DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.client_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  lead_client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  validated_location_id uuid NULL REFERENCES public.office_locations (id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  visit_purpose text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'scheduled'::text,
  planned_start_time time without time zone NULL,
  planned_end_time time without time zone NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_visits_pkey PRIMARY KEY (id),
  CONSTRAINT client_visits_status_check CHECK (
    lower(status) = ANY (
      ARRAY[
        'scheduled'::text,
        'completed'::text,
        'cancelled'::text,
        'ongoing'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_client_visits_organization_id ON public.client_visits USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_visit_date ON public.client_visits USING btree (visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_visits_lead_client_id ON public.client_visits USING btree (lead_client_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_employee_id ON public.client_visits USING btree (employee_id);

ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_visits_org_select" ON public.client_visits;
CREATE POLICY "client_visits_org_select"
  ON public.client_visits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "client_visits_org_insert" ON public.client_visits;
CREATE POLICY "client_visits_org_insert"
  ON public.client_visits FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "client_visits_org_update" ON public.client_visits;
CREATE POLICY "client_visits_org_update"
  ON public.client_visits FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "client_visits_org_delete" ON public.client_visits;
CREATE POLICY "client_visits_org_delete"
  ON public.client_visits FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_client_visits_updated_at ON public.client_visits;
CREATE TRIGGER update_client_visits_updated_at
  BEFORE UPDATE ON public.client_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.client_visits IS 'Scheduled client visits; FK lead_client_id -> clients for PostgREST embed clients().';
