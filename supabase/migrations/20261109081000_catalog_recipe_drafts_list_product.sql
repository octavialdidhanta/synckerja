-- Recipe draft list: include product_id and outlet_id so the Recipes page can mark menus that have an open draft.

CREATE OR REPLACE FUNCTION public._recipe_draft_list(p_user uuid, p_org uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'pending');
  v_out jsonb := '[]'::jsonb;
  v_row record;
  v_review jsonb;
BEGIN
  IF NOT public._recipe_is_member(p_user, p_org) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('pending', 'published', 'rejected', 'superseded', 'expired', 'all') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN
    SELECT d.id
    FROM public.catalog_recipe_drafts d
    WHERE d.organization_id = p_org
      AND (
        v_status = 'all'
        OR (v_status = 'pending' AND d.status = 'pending' AND d.expires_at > now())
        OR (v_status = 'expired' AND (d.status = 'expired' OR (d.status = 'pending' AND d.expires_at <= now())))
        OR (v_status NOT IN ('pending', 'expired') AND d.status = v_status)
      )
    ORDER BY d.created_at DESC
    LIMIT 50
  LOOP
    v_review := public._recipe_draft_review(v_row.id, p_user);
    v_out := v_out || jsonb_build_object(
      'id', v_row.id,
      'product_id', v_review #>> '{draft,product_id}',
      'outlet_id', v_review #>> '{draft,outlet_id}',
      'outlet_name', v_review #>> '{draft,outlet_name}',
      'product_name', v_review #>> '{draft,product_name}',
      'draft_type', v_review #>> '{draft,draft_type}',
      'status', v_review #>> '{draft,status}',
      'requested_by_name', v_review #>> '{draft,requested_by_name}',
      'request_note', v_review #>> '{draft,request_note}',
      'created_at', v_review #> '{draft,created_at}',
      'edited', v_review #> '{draft,edited}',
      'line_count', (SELECT count(*) FROM jsonb_array_elements(v_review -> 'rows') r WHERE (r ->> 'after_qty') IS NOT NULL),
      'hpp_before', v_review #> '{totals,hpp_before}',
      'hpp_after', v_review #> '{totals,hpp_after}',
      'warning_count', jsonb_array_length(v_review -> 'warnings'),
      'blocked', jsonb_array_length(v_review -> 'blocking') > 0
    );
  END LOOP;

  RETURN jsonb_build_object('status', v_status, 'drafts', v_out);
END;
$fn$;

REVOKE ALL ON FUNCTION public._recipe_draft_list(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
