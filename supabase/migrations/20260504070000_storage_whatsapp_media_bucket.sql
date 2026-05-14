-- Storage: whatsapp-media (shared for inbound/outbound WhatsApp & Instagram livechat media)
-- Required by:
-- - src/5-3-whatsapp/components/inbox/ChatThread.tsx (upload outbound media + getPublicUrl)
-- - supabase/functions/whatsapp-webhook (store inbound media + getPublicUrl)
-- - supabase/functions/resolve-whatsapp-media (lazy resolve inbound media + getPublicUrl)
--
-- NOTE: Bucket is public so Meta/WhatsApp can fetch media URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read (required for getPublicUrl + external fetchers)
DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;
CREATE POLICY "whatsapp_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

-- Authenticated users can write media objects (UI upload paths include conversation id + timestamped filename)
DROP POLICY IF EXISTS "whatsapp_media_authenticated_insert" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "whatsapp_media_authenticated_update" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'whatsapp-media')
  WITH CHECK (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "whatsapp_media_authenticated_delete" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'whatsapp-media');

