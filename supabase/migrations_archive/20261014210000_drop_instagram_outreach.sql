-- Remove Instagram outreach. Meta does not provide other accounts' commenter lists.

DROP TABLE IF EXISTS public.instagram_outreach_targets;
DROP TABLE IF EXISTS public.instagram_outreach_materials;
DROP TABLE IF EXISTS public.instagram_outreach_campaigns;

DROP FUNCTION IF EXISTS public.touch_instagram_outreach_updated_at();

DROP POLICY IF EXISTS instagram_outreach_media_storage_insert ON storage.objects;
DROP POLICY IF EXISTS instagram_outreach_media_storage_select ON storage.objects;
DROP POLICY IF EXISTS instagram_outreach_media_storage_update ON storage.objects;
DROP POLICY IF EXISTS instagram_outreach_media_storage_delete ON storage.objects;

DROP FUNCTION IF EXISTS public.instagram_outreach_storage_object_allowed(text);

DELETE FROM public.permission_configurations
WHERE page_path = '/omnichannel/campaign/instagram';

DELETE FROM public.permission_configuration_defaults
WHERE page_path = '/omnichannel/campaign/instagram';
