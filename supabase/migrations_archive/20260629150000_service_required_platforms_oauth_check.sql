-- Allow OAuth-linked required platforms (platform_account_id) without social_media_name/custom name.

ALTER TABLE public.service_required_platforms
  DROP CONSTRAINT IF EXISTS chk_custom_platform_name_if_null_social_media_name_id;

ALTER TABLE public.service_required_platforms
  ADD CONSTRAINT chk_service_required_platform_identity CHECK (
    (
      social_media_name_id IS NOT NULL
      AND custom_platform_name IS NULL
      AND (platform_account_id IS NULL OR length(trim(platform_account_id)) = 0)
    )
    OR (
      social_media_name_id IS NULL
      AND custom_platform_name IS NOT NULL
      AND length(trim(custom_platform_name)) > 0
      AND (platform_account_id IS NULL OR length(trim(platform_account_id)) = 0)
    )
    OR (
      social_media_name_id IS NULL
      AND custom_platform_name IS NULL
      AND platform_account_id IS NOT NULL
      AND length(trim(platform_account_id)) > 0
    )
  );
