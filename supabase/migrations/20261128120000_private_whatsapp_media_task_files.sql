-- Storage P1 step 4: whatsapp-media and task-files become private.
-- Every reader now asks for signed links (#341 inbox, #342 tasks + MCP tasks.get), allowed by the per-organization
-- SELECT policies whatsapp_media_authenticated_select_own_org and task_files_authenticated_select_own_org.
-- Public links stored in the database keep working as identifiers: the Office and MCP sign them on read.
-- Edge functions use the service role and are not affected by these policies.

DROP POLICY IF EXISTS whatsapp_media_public_read ON storage.objects;
DROP POLICY IF EXISTS task_files_public_read ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id IN ('whatsapp-media', 'task-files');
