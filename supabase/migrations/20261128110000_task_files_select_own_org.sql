-- Storage P1 step 2 (task-files): signed links for task attachments and description images.
-- createSignedUrl(s) needs a SELECT policy. A member may read an object only when the task, step or
-- org-<id>/pending folder in its path belongs to one of their organizations: the same rule as writes
-- (task_files_storage_can_write). No file is moved.
-- The public read policy stays until every reader uses signed links (step 4 makes the bucket private).

DROP POLICY IF EXISTS task_files_authenticated_select_own_org ON storage.objects;
CREATE POLICY task_files_authenticated_select_own_org
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-files'
    AND public.task_files_storage_can_write(name)
  );
