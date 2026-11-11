-- Referensi visual brief Content Plan. Tempel langsung, tanpa menunggu tinjau brief.
-- Paling banyak lima gambar per karyawan AI. Payload hanya mengirim posisi dan path, bukan URL.

CREATE TABLE IF NOT EXISTS public.ai_employee_brief_references (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  storage_path text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_brief_references_position_check CHECK (position BETWEEN 1 AND 5),
  CONSTRAINT ai_employee_brief_references_path_check CHECK (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-5]\.(png|jpe?g|webp)$'
  ),
  PRIMARY KEY (employee_id, position)
);

ALTER TABLE public.ai_employee_brief_references ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_employee_brief_references FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-employee-references',
  'ai-employee-references',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.ai_employee_reference_object_allowed(
  p_name text,
  p_write boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $allowed$
DECLARE
  v_org uuid;
  v_employee uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL OR p_name IS NULL THEN
    RETURN false;
  END IF;
  IF p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-5]\.(png|jpe?g|webp)$' THEN
    RETURN false;
  END IF;
  v_org := split_part(p_name, '/', 1)::uuid;
  v_employee := split_part(p_name, '/', 2)::uuid;
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = v_employee
      AND employee.organization_id = v_org
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RETURN false;
  END IF;
  SELECT lower(btrim(role.role))
  INTO v_role
  FROM public.user_roles role
  WHERE role.user_id = auth.uid()
    AND role.organization_id = v_org
    AND lower(btrim(role.role)) IN ('owner', 'admin')
  ORDER BY CASE lower(btrim(role.role)) WHEN 'owner' THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF COALESCE(p_write, false) THEN
    RETURN v_role = 'owner';
  END IF;
  RETURN true;
END;
$allowed$;

REVOKE ALL ON FUNCTION public.ai_employee_reference_object_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_reference_object_allowed(text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS ai_employee_references_select ON storage.objects;
CREATE POLICY ai_employee_references_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ai-employee-references'
    AND public.ai_employee_reference_object_allowed(name, false)
  );

DROP POLICY IF EXISTS ai_employee_references_insert ON storage.objects;
CREATE POLICY ai_employee_references_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ai-employee-references'
    AND public.ai_employee_reference_object_allowed(name, true)
  );

DROP POLICY IF EXISTS ai_employee_references_update ON storage.objects;
CREATE POLICY ai_employee_references_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ai-employee-references'
    AND public.ai_employee_reference_object_allowed(name, true)
  )
  WITH CHECK (
    bucket_id = 'ai-employee-references'
    AND public.ai_employee_reference_object_allowed(name, true)
  );

DROP POLICY IF EXISTS ai_employee_references_delete ON storage.objects;
CREATE POLICY ai_employee_references_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ai-employee-references'
    AND public.ai_employee_reference_object_allowed(name, true)
  );

CREATE OR REPLACE FUNCTION public.ai_employee_brief_reference_set(
  p_employee_id uuid,
  p_position smallint,
  p_storage_path text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $set$
DECLARE
  v_org uuid;
  v_old text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  IF p_position IS NULL OR p_position < 1 OR p_position > 5 OR p_storage_path IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_storage_path !~ (
    '^' || v_org::text || '/' || p_employee_id::text || '/' || p_position::text || '\.(png|jpe?g|webp)$'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects object
    WHERE object.bucket_id = 'ai-employee-references'
      AND object.name = p_storage_path
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ref.storage_path
  INTO v_old
  FROM public.ai_employee_brief_references ref
  WHERE ref.employee_id = p_employee_id
    AND ref.position = p_position;

  INSERT INTO public.ai_employee_brief_references (employee_id, organization_id, position, storage_path, updated_at)
  VALUES (p_employee_id, v_org, p_position, p_storage_path, now())
  ON CONFLICT (employee_id, position) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      storage_path = EXCLUDED.storage_path,
      updated_at = now();

  IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_storage_path THEN
    DELETE FROM storage.objects object
    WHERE object.bucket_id = 'ai-employee-references'
      AND object.name = v_old;
  END IF;
END;
$set$;

CREATE OR REPLACE FUNCTION public.ai_employee_brief_reference_clear(
  p_employee_id uuid,
  p_position smallint
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $clear$
DECLARE
  v_org uuid;
  v_path text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  IF p_position IS NULL OR p_position < 1 OR p_position > 5 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT ref.storage_path
  INTO v_path
  FROM public.ai_employee_brief_references ref
  WHERE ref.employee_id = p_employee_id
    AND ref.organization_id = v_org
    AND ref.position = p_position;

  DELETE FROM public.ai_employee_brief_references ref
  WHERE ref.employee_id = p_employee_id
    AND ref.organization_id = v_org
    AND ref.position = p_position;

  IF v_path IS NOT NULL THEN
    DELETE FROM storage.objects object
    WHERE object.bucket_id = 'ai-employee-references'
      AND object.name = v_path;
  END IF;
END;
$clear$;

REVOKE ALL ON FUNCTION public.ai_employee_brief_reference_set(uuid, smallint, text) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_reference_clear(uuid, smallint) FROM PUBLIC, anon, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_reference_set(uuid, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_reference_clear(uuid, smallint) TO authenticated;

COMMENT ON FUNCTION public.ai_employee_brief_reference_set(uuid, smallint, text) IS
  'Owner mencatat satu slot referensi visual setelah berkas ada di bucket privat.';
COMMENT ON FUNCTION public.ai_employee_brief_reference_clear(uuid, smallint) IS
  'Owner mengosongkan satu slot referensi visual dan menghapus berkasnya.';

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure),
    E'\r',
    ''
  );
  found_marker text := $m$'repeat_voices', to_jsonb(v_row.repeat_voices)$m$;
  empty_marker text := $m$'repeat_voices', '[]'::jsonb$m$;
  found_insert text := replace($n$'repeat_voices', to_jsonb(v_row.repeat_voices),
    'references', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'position', ref.position,
        'storage_path', ref.storage_path
      ) ORDER BY ref.position)
      FROM public.ai_employee_brief_references ref
      WHERE ref.employee_id = p_employee_id
        AND ref.organization_id = v_org
    ), '[]'::jsonb)$n$, E'\r', '');
  empty_insert text := replace($n$'repeat_voices', '[]'::jsonb,
    'references', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'position', ref.position,
        'storage_path', ref.storage_path
      ) ORDER BY ref.position)
      FROM public.ai_employee_brief_references ref
      WHERE ref.employee_id = p_employee_id
    ), '[]'::jsonb)$n$, E'\r', '');
BEGIN
  IF position(found_marker IN def) = 0 OR position(empty_marker IN def) = 0 THEN
    RAISE EXCEPTION 'brief reference snippet missing';
  END IF;
  IF position(
    $already$'references', COALESCE(($already$
    IN substring(def FROM position(found_marker IN def) FOR 400)
  ) = 0 THEN
    def := replace(def, found_marker, found_insert);
    def := replace(def, empty_marker, empty_insert);
    EXECUTE def;
  END IF;
END;
$patch$;

NOTIFY pgrst, 'reload schema';
