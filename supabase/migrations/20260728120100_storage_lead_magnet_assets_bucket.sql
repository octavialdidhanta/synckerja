-- Public bucket for Lead Magnet delivery assets (Meta web_url button requires HTTPS public URL).
-- Path: {organization_id}/{campaign_id}/{asset_uuid}_{filename}

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-magnet-assets', 'lead-magnet-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE OR REPLACE FUNCTION public.lead_magnet_assets_storage_can_write(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_magnet_campaigns c
    WHERE c.organization_id::text = (storage.foldername(p_name))[1]
      AND c.id::text = (storage.foldername(p_name))[2]
      AND c.organization_id IN (SELECT public.user_organization_ids())
  );
$$;

REVOKE ALL ON FUNCTION public.lead_magnet_assets_storage_can_write(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_magnet_assets_storage_can_write(text) TO authenticated;

DROP POLICY IF EXISTS "lead_magnet_assets_public_read" ON storage.objects;
CREATE POLICY "lead_magnet_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lead-magnet-assets');

DROP POLICY IF EXISTS "lead_magnet_assets_authenticated_insert" ON storage.objects;
CREATE POLICY "lead_magnet_assets_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-magnet-assets'
    AND public.lead_magnet_assets_storage_can_write(name)
  );

DROP POLICY IF EXISTS "lead_magnet_assets_authenticated_update" ON storage.objects;
CREATE POLICY "lead_magnet_assets_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lead-magnet-assets'
    AND public.lead_magnet_assets_storage_can_write(name)
  )
  WITH CHECK (
    bucket_id = 'lead-magnet-assets'
    AND public.lead_magnet_assets_storage_can_write(name)
  );

DROP POLICY IF EXISTS "lead_magnet_assets_authenticated_delete" ON storage.objects;
CREATE POLICY "lead_magnet_assets_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lead-magnet-assets'
    AND public.lead_magnet_assets_storage_can_write(name)
  );
