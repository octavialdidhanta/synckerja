-- whatsapp-media: no listing, browser upload only into the caller's own conversation,
-- and no browser overwrite or delete. Public object URLs stay readable for Meta.

DROP POLICY IF EXISTS "whatsapp_media_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_authenticated_delete" ON storage.objects;

DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;
CREATE POLICY "whatsapp_media_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'whatsapp-media'
    AND NOT storage.allow_any_operation(ARRAY[
      'storage.object.list',
      'storage.object.list_v2'
    ])
  );

DROP POLICY IF EXISTS "whatsapp_media_authenticated_insert" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND position('../' in name) = 0
    AND (
      (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.whatsapp_conversations c
          JOIN public.profiles p ON p.user_id = (SELECT auth.uid())
          WHERE c.id::text = (storage.foldername(name))[1]
            AND c.organization_id = p.active_organization_id
        )
      )
      OR (
        (storage.foldername(name))[1] = 'ig'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.instagram_conversations c
          JOIN public.profiles p ON p.user_id = (SELECT auth.uid())
          WHERE c.id::text = (storage.foldername(name))[2]
            AND c.organization_id = p.active_organization_id
        )
      )
      OR (
        (storage.foldername(name))[1] = 'fb'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.facebook_conversations c
          JOIN public.profiles p ON p.user_id = (SELECT auth.uid())
          WHERE c.id::text = (storage.foldername(name))[2]
            AND c.organization_id = p.active_organization_id
        )
      )
    )
  );
