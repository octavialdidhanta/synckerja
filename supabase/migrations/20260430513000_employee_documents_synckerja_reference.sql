-- public.employee_documents — synckerja-reference types (useEmployeeDocuments hooks).
-- Fixes: PostgREST 404 / PGRST205 (table missing on deployed DB).

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NULL,
  mime_type text NULL,
  notes text NULL,
  uploaded_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  is_verified boolean NULL DEFAULT false,
  verified_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id
  ON public.employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type
  ON public.employee_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_employee_documents_created_at
  ON public.employee_documents (created_at DESC);

COMMENT ON TABLE public.employee_documents IS
  'Employee documents (education/work/personal docs) aligned with synckerja-reference.';

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_documents_select" ON public.employee_documents;
CREATE POLICY "employee_documents_select"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_documents.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_documents_insert" ON public.employee_documents;
CREATE POLICY "employee_documents_insert"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_documents.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_documents_update" ON public.employee_documents;
CREATE POLICY "employee_documents_update"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (
    employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_documents.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  )
  WITH CHECK (
    employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_documents.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_documents_delete" ON public.employee_documents;
CREATE POLICY "employee_documents_delete"
  ON public.employee_documents FOR DELETE TO authenticated
  USING (
    employee_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_documents.employee_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR (
            e.organization_id IS NOT NULL
            AND e.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

DROP TRIGGER IF EXISTS employee_documents_updated_at ON public.employee_documents;
CREATE TRIGGER employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

