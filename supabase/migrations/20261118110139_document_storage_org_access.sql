-- Document buckets: browser access follows the caller's active organization.
-- Sales contracts and AI reference images already check their own gates and stay as they are.
-- task-files keeps a direct public URL, and listing is closed.

CREATE OR REPLACE FUNCTION public.storage_active_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.active_organization_id
  FROM public.profiles p
  WHERE p.user_id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.storage_user_in_active_org(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.storage_active_organization_id() IS NOT NULL
    AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        WHERE uo.user_id::text = p_user_id
          AND uo.organization_id = public.storage_active_organization_id()
      )
      OR EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id::text = p_user_id
          AND e.organization_id = public.storage_active_organization_id()
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.employee_document_in_active_org(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
  v_second text;
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN
    RETURN false;
  END IF;
  v_top := (storage.foldername(p_name))[1];
  v_second := (storage.foldername(p_name))[2];
  IF v_top IN ('asset-handover', 'company-assets') THEN
    RETURN v_second ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND v_second = v_org::text;
  END IF;
  IF v_top ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id::text = v_top
        AND e.organization_id = v_org
    );
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_receipt_in_active_org(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN
    RETURN false;
  END IF;
  v_top := (storage.foldername(p_name))[1];
  IF v_top !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN v_top = v_org::text
    OR public.storage_user_in_active_org(v_top);
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_document_in_active_org(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
  v_second text;
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN
    RETURN false;
  END IF;
  v_top := (storage.foldername(p_name))[1];
  v_second := (storage.foldername(p_name))[2];
  IF v_top = 'invoices' THEN
    RETURN v_second ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND v_second = v_org::text;
  END IF;
  RETURN v_top ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND v_top = v_org::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.recruitment_file_in_active_org(p_name text, p_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
  v_owner uuid := COALESCE(p_owner, (SELECT auth.uid()));
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN
    RETURN false;
  END IF;
  v_top := (storage.foldername(p_name))[1];
  IF v_top = 'cvs' THEN
    RETURN public.storage_user_in_active_org(v_owner::text);
  END IF;
  IF v_top ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF EXISTS (
      SELECT 1
      FROM public.candidate_profiles c
      WHERE c.id::text = v_top
        AND c.organization_id = v_org
    ) OR EXISTS (
      SELECT 1
      FROM public.candidate_documents d
      JOIN public.candidate_profiles c ON c.id = d.candidate_profile_id
      WHERE d.file_path = p_name
        AND c.organization_id = v_org
    ) OR EXISTS (
      SELECT 1
      FROM public.candidate_profiles c
      WHERE c.cv_file_path = p_name
        AND c.organization_id = v_org
    ) THEN
      RETURN true;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.candidate_profiles c
      WHERE c.id::text = v_top
        AND c.organization_id IS DISTINCT FROM v_org
    ) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN public.storage_user_in_active_org(v_owner::text);
END;
$$;

REVOKE ALL ON FUNCTION public.storage_active_organization_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_user_in_active_org(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.employee_document_in_active_org(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_receipt_in_active_org(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_document_in_active_org(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recruitment_file_in_active_org(text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.storage_active_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.storage_user_in_active_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.employee_document_in_active_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_receipt_in_active_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_document_in_active_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recruitment_file_in_active_org(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "employee_documents_authenticated_all" ON storage.objects;
DROP POLICY IF EXISTS "employee_documents_select_authenticated" ON storage.objects;
CREATE POLICY "employee_documents_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.employee_document_in_active_org(name)
  );
CREATE POLICY "employee_documents_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND public.employee_document_in_active_org(name)
  );
CREATE POLICY "employee_documents_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.employee_document_in_active_org(name)
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND public.employee_document_in_active_org(name)
  );
CREATE POLICY "employee_documents_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.employee_document_in_active_org(name)
  );

DROP POLICY IF EXISTS "recruitment_files_authenticated_all" ON storage.objects;
CREATE POLICY "recruitment_files_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'recruitment-files'
    AND public.recruitment_file_in_active_org(name, owner)
  );
CREATE POLICY "recruitment_files_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recruitment-files'
    AND public.recruitment_file_in_active_org(name, owner)
  );
CREATE POLICY "recruitment_files_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recruitment-files'
    AND public.recruitment_file_in_active_org(name, owner)
  )
  WITH CHECK (
    bucket_id = 'recruitment-files'
    AND public.recruitment_file_in_active_org(name, owner)
  );
CREATE POLICY "recruitment_files_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recruitment-files'
    AND public.recruitment_file_in_active_org(name, owner)
  );

DROP POLICY IF EXISTS "income-receipts: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "income-receipts: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "income-receipts: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "income-receipts: authenticated delete" ON storage.objects;
CREATE POLICY "income_receipts_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "income_receipts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'income-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "income_receipts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND public.finance_receipt_in_active_org(name)
  )
  WITH CHECK (
    bucket_id = 'income-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "income_receipts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'income-receipts'
    AND public.finance_receipt_in_active_org(name)
  );

DROP POLICY IF EXISTS "sales-receipts: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "sales-receipts: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "sales-receipts: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "sales-receipts: authenticated delete" ON storage.objects;
CREATE POLICY "sales_receipts_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sales-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "sales_receipts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sales-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "sales_receipts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sales-receipts'
    AND public.finance_receipt_in_active_org(name)
  )
  WITH CHECK (
    bucket_id = 'sales-receipts'
    AND public.finance_receipt_in_active_org(name)
  );
CREATE POLICY "sales_receipts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sales-receipts'
    AND public.finance_receipt_in_active_org(name)
  );

DROP POLICY IF EXISTS "purchase-documents: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "purchase-documents: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "purchase-documents: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "purchase-documents: authenticated delete" ON storage.objects;
CREATE POLICY "purchase_documents_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND public.purchase_document_in_active_org(name)
  );
CREATE POLICY "purchase_documents_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'purchase-documents'
    AND public.purchase_document_in_active_org(name)
  );
CREATE POLICY "purchase_documents_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND public.purchase_document_in_active_org(name)
  )
  WITH CHECK (
    bucket_id = 'purchase-documents'
    AND public.purchase_document_in_active_org(name)
  );
CREATE POLICY "purchase_documents_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'purchase-documents'
    AND public.purchase_document_in_active_org(name)
  );

DROP POLICY IF EXISTS "task_files_public_read" ON storage.objects;
CREATE POLICY "task_files_public_read"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'task-files'
    AND NOT storage.allow_any_operation(ARRAY[
      'storage.object.list',
      'storage.object.list_v2'
    ])
  );
