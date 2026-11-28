-- Storage P1 step 2 (whatsapp-media): signed links for the Office inbox.
-- createSignedUrl(s) needs a SELECT policy. A member may read an object only when the conversation in its
-- path belongs to one of their organizations. No file is moved: every path already carries the conversation id.
--
-- Paths written today:
--   inbound/<wa conversation id>/<file>        whatsapp-webhook, resolve-whatsapp-media
--   ig/inbound/<ig conversation id>/<file>     instagram-webhook, resolve-instagram-media
--   fb/inbound/<fb conversation id>/<file>     facebook messenger webhook, resolve-facebook-media
--   <wa conversation id>/<file>                Office outbound (ChatThread)
--   ig/<ig conversation id>/<file>             Office outbound
--   fb/<fb conversation id>/<file>             Office outbound
--
-- The public read policy stays until every reader uses signed links (step 4 makes the bucket private).

CREATE OR REPLACE FUNCTION public.whatsapp_media_can_read(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH parts AS (
    SELECT storage.foldername(p_name) AS f
  ),
  target AS (
    SELECT
      CASE
        WHEN f[1] = 'inbound' THEN 'wa'
        WHEN f[1] IN ('ig', 'fb') THEN f[1]
        ELSE 'wa'
      END AS channel,
      CASE
        WHEN f[1] = 'inbound' THEN f[2]
        WHEN f[1] IN ('ig', 'fb') AND f[2] = 'inbound' THEN f[3]
        WHEN f[1] IN ('ig', 'fb') THEN f[2]
        ELSE f[1]
      END AS conversation_id
    FROM parts
  )
  SELECT COALESCE((
    SELECT CASE t.channel
      WHEN 'wa' THEN EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        WHERE c.id::text = t.conversation_id
          AND c.organization_id IN (SELECT public.user_organization_ids())
      )
      WHEN 'ig' THEN EXISTS (
        SELECT 1 FROM public.instagram_conversations c
        WHERE c.id::text = t.conversation_id
          AND c.organization_id IN (SELECT public.user_organization_ids())
      )
      WHEN 'fb' THEN EXISTS (
        SELECT 1 FROM public.facebook_conversations c
        WHERE c.id::text = t.conversation_id
          AND c.organization_id IN (SELECT public.user_organization_ids())
      )
      ELSE false
    END
    FROM target t
    WHERE t.conversation_id IS NOT NULL
  ), false);
$$;

REVOKE ALL ON FUNCTION public.whatsapp_media_can_read(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_media_can_read(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_media_can_read(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_media_can_read(text) TO service_role;

COMMENT ON FUNCTION public.whatsapp_media_can_read(text) IS
  'whatsapp-media: true when the conversation id in the object path belongs to one of the caller''s organizations.';

DROP POLICY IF EXISTS whatsapp_media_authenticated_select_own_org ON storage.objects;
CREATE POLICY whatsapp_media_authenticated_select_own_org
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.whatsapp_media_can_read(name)
  );
