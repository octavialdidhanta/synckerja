-- Synckerja Agent — step 5: after a video is final, the Agent moves its raw inbox footage into bank-footage.
--
-- A clip in the inbox is ready to move once it has a usage whose content is final:
--   * the usage's plan (social_media_plan_id, or a plan whose id starts with external_ref, the 8-char
--     ContentID the video editor logs) has production_approved = true, or
--   * the usage points at no plan at all and was logged more than 24 hours ago.
-- The Agent moves the file on the laptop first (size + md5 checked, never overwriting), then reports
-- the new address here. Only the address and storage_status change; thumbnails and previews stay.

CREATE OR REPLACE FUNCTION public.agent_footage_movable(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $movable$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object('clips', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'asset_id', a.id,
      'file_key', a.file_key,
      'media_type', a.media_type,
      'location', a.location_label,
      'product', a.product_label,
      'tag_status', a.tag_status
    ) ORDER BY a.created_at)
    FROM public.footage_assets a
    WHERE a.organization_id = v_org
      AND a.storage_status = 'inbox'
      AND a.deleted_at IS NULL
      AND a.tag_status <> 'belum'
      AND upper(a.file_key) LIKE 'INBOX/%'
      AND EXISTS (
        SELECT 1
        FROM public.footage_usages u
        LEFT JOIN LATERAL (
          SELECT p.production_approved
          FROM public.social_media_plans p
          WHERE p.organization_id = v_org
            AND (
              p.id = u.social_media_plan_id
              OR (u.social_media_plan_id IS NULL
                  AND u.external_ref ~ '^[0-9a-f]{8}$'
                  AND p.id::text LIKE u.external_ref || '%')
            )
          ORDER BY (p.id = u.social_media_plan_id) DESC
          LIMIT 1
        ) plan ON true
        WHERE u.asset_id = a.id
          AND (
            plan.production_approved IS TRUE
            OR (plan.production_approved IS NULL AND u.created_at < now() - interval '24 hours')
          )
      )
  ), '[]'::jsonb));
END;
$movable$;

CREATE OR REPLACE FUNCTION public.agent_footage_moved(p_token_id uuid, p_asset_id uuid, p_new_file_key text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $moved$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_asset public.footage_assets%ROWTYPE;
  v_new text := public.mcp_footage_clean_key(p_new_file_key);
BEGIN
  -- A bank address: relative, forward slashes, no "..", not back into the inbox.
  IF v_new ~ '(^|/)\.\.(/|$)' OR v_new ~ '^[/\\]' OR v_new ~ '\\' OR v_new ~ '^[A-Za-z]:'
     OR upper(v_new) LIKE 'INBOX/%' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_asset
  FROM public.footage_assets
  WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.storage_status <> 'inbox' THEN
    -- Already moved (a retry after a lost reply): fine when it is the same address.
    IF v_asset.file_key = v_new THEN
      RETURN jsonb_build_object('asset_id', p_asset_id, 'file_key', v_new, 'storage_status', v_asset.storage_status);
    END IF;
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.footage_assets o
    WHERE o.organization_id = v_org AND o.file_key = v_new AND o.id <> p_asset_id
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('synckerja.agent_write', 'on', true);
  UPDATE public.footage_assets
  SET file_key = v_new, storage_status = 'bank', updated_at = now()
  WHERE id = p_asset_id;

  RETURN jsonb_build_object('asset_id', p_asset_id, 'file_key', v_new, 'storage_status', 'bank', 'previous', v_asset.file_key);
END;
$moved$;

REVOKE ALL ON FUNCTION public.agent_footage_movable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_movable(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_moved(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_moved(uuid, uuid, text) TO service_role;
