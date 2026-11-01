-- Lead magnet draft read and delivery file attach for the connector.
-- Membership is checked here. EXECUTE is service_role only.
-- Does not publish, choose an account, or send a comment or DM.

CREATE OR REPLACE FUNCTION public.mcp_list_lead_magnet_drafts(
  p_user_id uuid,
  p_organization_id uuid,
  p_campaign_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  target_market text,
  keyword text,
  comment_reply_text text,
  follow_gate_text text,
  framework_offer_text text,
  delivery_text text,
  delivery_button_label text,
  has_file boolean,
  file_name text,
  social_media_plan_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    campaign.id,
    left(campaign.name, 4000),
    left(coalesce(campaign.target_market, ''), 4000),
    left(campaign.keyword, 4000),
    left(campaign.comment_reply_text, 4000),
    left(campaign.follow_gate_text, 4000),
    left(campaign.framework_offer_text, 4000),
    left(campaign.delivery_text, 4000),
    left(coalesce(campaign.delivery_button_label, ''), 4000),
    (campaign.delivery_mode = 'upload' AND nullif(btrim(coalesce(campaign.delivery_storage_path, '')), '') IS NOT NULL),
    nullif(left(coalesce(campaign.delivery_file_name, ''), 200), ''),
    campaign.social_media_plan_id
  FROM public.lead_magnet_campaigns campaign
  WHERE campaign.organization_id = p_organization_id
    AND campaign.status = 'draft'
    AND (p_campaign_id IS NULL OR campaign.id = p_campaign_id)
  ORDER BY campaign.updated_at DESC, campaign.id DESC
  LIMIT CASE WHEN p_campaign_id IS NULL THEN 30 ELSE 1 END;

  IF p_campaign_id IS NOT NULL AND NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_set_lead_magnet_delivery(
  p_user_id uuid,
  p_organization_id uuid,
  p_campaign_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime text,
  p_size_bytes integer,
  p_public_url text
)
RETURNS TABLE (
  id uuid,
  file_name text,
  has_file boolean,
  previous_storage_path text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_status text;
  v_previous text;
  v_name text;
  v_path text;
  v_url text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_path := btrim(coalesce(p_storage_path, ''));
  v_name := btrim(coalesce(p_file_name, ''));
  v_url := btrim(coalesce(p_public_url, ''));
  IF v_path <> lower(v_path)
    OR v_path !~ (
      '^' || lower(p_organization_id::text) || '/' || lower(p_campaign_id::text) ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[a-z0-9._-]+\.pdf$'
    )
    OR v_name = ''
    OR char_length(v_name) > 200
    OR position('/' IN v_name) > 0
    OR lower(p_mime) <> 'application/pdf'
    OR p_size_bytes IS NULL
    OR p_size_bytes <= 0
    OR p_size_bytes > 26214400
    OR left(v_url, 8) <> 'https://'
    OR char_length(v_url) > 2000
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT campaign.status, campaign.delivery_storage_path
  INTO v_status, v_previous
  FROM public.lead_magnet_campaigns campaign
  WHERE campaign.id = p_campaign_id
    AND campaign.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'not_draft' USING ERRCODE = '42501';
  END IF;

  UPDATE public.lead_magnet_campaigns campaign
  SET
    delivery_mode = 'upload',
    delivery_storage_path = v_path,
    delivery_file_name = v_name,
    delivery_file_mime = 'application/pdf',
    delivery_file_size_bytes = p_size_bytes,
    delivery_url = v_url
  WHERE campaign.id = p_campaign_id
    AND campaign.organization_id = p_organization_id;

  id := p_campaign_id;
  file_name := v_name;
  has_file := true;
  previous_storage_path := nullif(btrim(coalesce(v_previous, '')), '');
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_lead_magnet_drafts(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_lead_magnet_drafts(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_lead_magnet_drafts(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_set_lead_magnet_delivery(uuid, uuid, uuid, text, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_set_lead_magnet_delivery(uuid, uuid, uuid, text, text, text, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_lead_magnet_delivery(uuid, uuid, uuid, text, text, text, integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
