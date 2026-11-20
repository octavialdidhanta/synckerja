-- Storage bucket for Daily Task attachments and step-description inline images.
-- Paths used by the app:
--   task-files/{taskId}/{file}
--   task-step-files/{taskStepId}/{file}
--   task-step-description-images/{stepId|org-{orgId}/pending}/{file}
--   {taskStepId}/{file}  (legacy OKR activities upload)

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE OR REPLACE FUNCTION public.task_files_storage_can_write(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE (storage.foldername(p_name))[1]
    WHEN 'task-files' THEN EXISTS (
      SELECT 1
      FROM public.daily_tasks dt
      WHERE dt.id::text = (storage.foldername(p_name))[2]
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
    WHEN 'task-step-files' THEN EXISTS (
      SELECT 1
      FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id::text = (storage.foldername(p_name))[2]
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
    WHEN 'task-step-description-images' THEN (
      CASE
        WHEN (storage.foldername(p_name))[2] LIKE 'org-%'
          AND (storage.foldername(p_name))[3] = 'pending' THEN
          substring((storage.foldername(p_name))[2] FROM 5)::uuid
            IN (SELECT public.user_organization_ids())
        ELSE EXISTS (
          SELECT 1
          FROM public.task_steps ts
          JOIN public.daily_tasks dt ON dt.id = ts.task_id
          WHERE ts.id::text = (storage.foldername(p_name))[2]
            AND dt.organization_id IN (SELECT public.user_organization_ids())
        )
      END
    )
    ELSE EXISTS (
      SELECT 1
      FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id::text = (storage.foldername(p_name))[1]
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.task_files_storage_can_write(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_files_storage_can_write(text) TO authenticated;

DROP POLICY IF EXISTS "task_files_public_read" ON storage.objects;
CREATE POLICY "task_files_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-files');

DROP POLICY IF EXISTS "task_files_authenticated_insert" ON storage.objects;
CREATE POLICY "task_files_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-files'
    AND public.task_files_storage_can_write(name)
  );

DROP POLICY IF EXISTS "task_files_authenticated_update" ON storage.objects;
CREATE POLICY "task_files_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'task-files'
    AND public.task_files_storage_can_write(name)
  )
  WITH CHECK (
    bucket_id = 'task-files'
    AND public.task_files_storage_can_write(name)
  );

DROP POLICY IF EXISTS "task_files_authenticated_delete" ON storage.objects;
CREATE POLICY "task_files_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-files'
    AND public.task_files_storage_can_write(name)
  );
