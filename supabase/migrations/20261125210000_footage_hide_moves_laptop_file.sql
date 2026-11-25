-- Hiding a clip also asks the laptop Agent to move the file out of the watched
-- inbox or bank folder. The file stays in the Agent's dihapus folder for 30 days
-- so restore can put it back. After that the Agent deletes the held file.
-- A clip with no laptop file is still hidden; the Agent reports it missing.

CREATE TABLE public.footage_file_holds (
  asset_id uuid PRIMARY KEY REFERENCES public.footage_assets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  original_file_key text NOT NULL,
  hold_key text,
  phase text NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_file_holds_phase_check CHECK (phase IN ('hide', 'restore')),
  CONSTRAINT footage_file_holds_status_check CHECK (status IN ('pending', 'held', 'missing', 'back', 'purged')),
  CONSTRAINT footage_file_holds_key_check CHECK (char_length(btrim(original_file_key)) BETWEEN 1 AND 2000),
  CONSTRAINT footage_file_holds_hold_key_check CHECK (
    hold_key IS NULL OR hold_key ~ '^[0-9a-f-]{36}/[^/\\.][^/\\]{0,199}$'
  )
);

COMMENT ON TABLE public.footage_file_holds IS
  'Laptop file for a hidden clip. pending hide: Agent should move it out of the watched folder. held: it sits in dihapus. restore: put it back. purged: the held file was deleted after 30 days.';

CREATE INDEX footage_file_holds_org_open_idx
  ON public.footage_file_holds (organization_id, phase, status);

ALTER TABLE public.footage_file_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.footage_file_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.footage_file_holds TO service_role;

CREATE OR REPLACE FUNCTION public.catalog_queue_footage_hide(
  p_organization_id uuid,
  p_asset_id uuid,
  p_file_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $queue_hide$
BEGIN
  INSERT INTO public.footage_file_holds (
    asset_id, organization_id, original_file_key, hold_key, phase, status
  ) VALUES (
    p_asset_id, p_organization_id, p_file_key, NULL, 'hide', 'pending'
  )
  ON CONFLICT (asset_id) DO UPDATE
    SET original_file_key = EXCLUDED.original_file_key,
        hold_key = NULL,
        phase = 'hide',
        status = 'pending',
        updated_at = now();
END;
$queue_hide$;

CREATE OR REPLACE FUNCTION public.catalog_queue_footage_restore(
  p_organization_id uuid,
  p_asset_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $queue_restore$
DECLARE
  v_hold public.footage_file_holds%ROWTYPE;
BEGIN
  SELECT *
  INTO v_hold
  FROM public.footage_file_holds
  WHERE asset_id = p_asset_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND OR v_hold.status IN ('missing', 'purged', 'back') THEN
    DELETE FROM public.footage_file_holds
    WHERE asset_id = p_asset_id
      AND organization_id = p_organization_id;
    RETURN;
  END IF;

  UPDATE public.footage_file_holds
  SET phase = 'restore',
      status = 'pending',
      updated_at = now()
  WHERE asset_id = p_asset_id
    AND organization_id = p_organization_id;
END;
$queue_restore$;

CREATE OR REPLACE FUNCTION public.catalog_hide_footage(
  p_organization_id uuid,
  p_asset_id uuid,
  p_acknowledge boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $hide$
DECLARE
  v_asset public.footage_assets%ROWTYPE;
  v_count integer;
  v_deleted timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(auth.uid(), p_organization_id);
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.id = p_asset_id
    AND a.organization_id = p_organization_id
    AND a.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM public.footage_usages u
  WHERE u.organization_id = p_organization_id
    AND u.asset_id = p_asset_id;

  IF v_count > 0 AND COALESCE(p_acknowledge, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'saved', false,
      'needs_ack', true,
      'usage_count', v_count,
      'file_key', v_asset.file_key
    );
  END IF;

  UPDATE public.footage_assets a
  SET deleted_at = now()
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id
    AND a.deleted_at IS NULL
  RETURNING a.deleted_at INTO v_deleted;

  PERFORM public.catalog_queue_footage_hide(p_organization_id, v_asset.id, v_asset.file_key);

  RETURN jsonb_build_object(
    'saved', true,
    'needs_ack', false,
    'file_key', v_asset.file_key,
    'deleted_at', v_deleted,
    'purge_after', v_deleted + public.catalog_media_grace()
  );
END;
$hide$;

CREATE OR REPLACE FUNCTION public.catalog_restore_footage(
  p_organization_id uuid,
  p_asset_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $restore$
DECLARE
  v_asset public.footage_assets%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(auth.uid(), p_organization_id);
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.id = p_asset_id
    AND a.organization_id = p_organization_id
    AND a.deleted_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.deleted_at <= now() - public.catalog_media_grace() THEN
    RAISE EXCEPTION 'restore_expired' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.footage_assets a
  SET deleted_at = NULL
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id;

  PERFORM public.catalog_queue_footage_restore(p_organization_id, v_asset.id);

  RETURN jsonb_build_object('saved', true, 'file_key', v_asset.file_key);
END;
$restore$;

CREATE OR REPLACE FUNCTION public.catalog_list_hidden_footage(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_hidden$
BEGIN
  PERFORM public.mcp_footage_require_member(auth.uid(), p_organization_id);
  RETURN jsonb_build_object(
    'clips', COALESCE((
      SELECT jsonb_agg(item.obj ORDER BY item.deleted_at DESC)
      FROM (
        SELECT jsonb_build_object(
          'asset_id', a.id,
          'file_key', a.file_key,
          'summary', a.summary,
          'deleted_at', a.deleted_at,
          'purge_after', a.deleted_at + public.catalog_media_grace(),
          'scene_count', (
            SELECT count(*)::int
            FROM public.footage_scenes s
            WHERE s.asset_id = a.id
              AND s.organization_id = a.organization_id
          )
        ) AS obj,
        a.deleted_at
        FROM public.footage_assets a
        WHERE a.organization_id = p_organization_id
          AND a.deleted_at IS NOT NULL
          AND a.deleted_at > now() - public.catalog_media_grace()
        ORDER BY a.deleted_at DESC
        LIMIT 50
      ) item
    ), '[]'::jsonb)
  );
END;
$list_hidden$;

-- MCP delete and restore use the same file queue as the page button.

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_delete(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_delete$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_count integer;
  v_digest text;
  v_deleted timestamptz;
  v_files jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'footage.delete'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND a.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_asset.id::text <> v_payload->>'asset_id' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM public.footage_usages u
  WHERE u.organization_id = v_asset.organization_id
    AND u.asset_id = v_asset.id;
  v_digest := public.catalog_footage_usage_digest(v_asset.organization_id, v_asset.id);
  IF v_digest IS DISTINCT FROM COALESCE(v_payload->>'usage_digest', '')
     OR v_count IS DISTINCT FROM COALESCE((v_payload->>'usage_count')::integer, -1) THEN
    RAISE EXCEPTION 'used_since_preview' USING ERRCODE = 'P0001';
  END IF;
  IF v_count > 0 AND COALESCE((v_payload->>'acknowledge_used')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'used_needs_confirm' USING ERRCODE = 'P0001';
  END IF;

  v_files := public.catalog_footage_storage_paths(v_asset.id, v_asset.organization_id);

  UPDATE public.footage_assets a
  SET deleted_at = now()
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id
    AND a.deleted_at IS NULL
  RETURNING a.deleted_at INTO v_deleted;

  PERFORM public.catalog_queue_footage_hide(p_organization_id, v_asset.id, v_asset.file_key);

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'deleted_at', v_deleted,
    'purge_after', v_deleted + public.catalog_media_grace(),
    'storage_kept', true,
    'storage_files', v_files
  );
END;
$apply_delete$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_restore(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_restore$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'footage.restore'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND a.deleted_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR v_asset.id::text <> v_payload->>'asset_id' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.deleted_at <= now() - public.catalog_media_grace() THEN
    RAISE EXCEPTION 'restore_expired' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.footage_assets a
  SET deleted_at = NULL
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id;

  PERFORM public.catalog_queue_footage_restore(p_organization_id, v_asset.id);

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'deleted_at', NULL
  );
END;
$apply_restore$;

CREATE OR REPLACE FUNCTION public.agent_footage_file_tasks(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $tasks$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object(
    'tasks', COALESCE((
      SELECT jsonb_agg(q.obj)
      FROM (
        SELECT u.obj
        FROM (
          SELECT jsonb_build_object(
            'asset_id', h.asset_id,
            'action', 'hide',
            'file_key', h.original_file_key,
            'hold_key', NULL
          ) AS obj
          FROM public.footage_file_holds h
          JOIN public.footage_assets a
            ON a.id = h.asset_id
           AND a.organization_id = h.organization_id
          WHERE h.organization_id = v_org
            AND h.phase = 'hide'
            AND h.status = 'pending'
            AND a.deleted_at IS NOT NULL
          UNION ALL
          SELECT jsonb_build_object(
            'asset_id', h.asset_id,
            'action', 'restore',
            'file_key', h.original_file_key,
            'hold_key', h.hold_key
          )
          FROM public.footage_file_holds h
          JOIN public.footage_assets a
            ON a.id = h.asset_id
           AND a.organization_id = h.organization_id
          WHERE h.organization_id = v_org
            AND h.phase = 'restore'
            AND h.status = 'pending'
            AND a.deleted_at IS NULL
          UNION ALL
          SELECT jsonb_build_object(
            'asset_id', h.asset_id,
            'action', 'purge',
            'file_key', h.original_file_key,
            'hold_key', h.hold_key
          )
          FROM public.footage_file_holds h
          JOIN public.footage_assets a
            ON a.id = h.asset_id
           AND a.organization_id = h.organization_id
          WHERE h.organization_id = v_org
            AND h.phase = 'hide'
            AND h.status = 'held'
            AND a.deleted_at IS NOT NULL
            AND a.deleted_at <= now() - public.catalog_media_grace()
        ) u
        LIMIT 20
      ) q
    ), '[]'::jsonb)
  );
END;
$tasks$;

CREATE OR REPLACE FUNCTION public.agent_footage_file_task_done(
  p_token_id uuid,
  p_asset_id uuid,
  p_result text,
  p_hold_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $task_done$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_hold public.footage_file_holds%ROWTYPE;
  v_deleted timestamptz;
BEGIN
  IF p_asset_id IS NULL OR p_result NOT IN ('held', 'missing', 'back', 'purged') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_hold
  FROM public.footage_file_holds h
  WHERE h.asset_id = p_asset_id
    AND h.organization_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.deleted_at
  INTO v_deleted
  FROM public.footage_assets a
  WHERE a.id = p_asset_id
    AND a.organization_id = v_org;

  IF p_result = 'held' THEN
    IF v_hold.phase <> 'hide' OR v_hold.status <> 'pending' OR v_deleted IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF p_hold_key IS NULL OR p_hold_key !~ ('^' || p_asset_id::text || '/[^/\\.][^/\\]{0,199}$') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.footage_file_holds
    SET status = 'held',
        hold_key = p_hold_key,
        updated_at = now()
    WHERE asset_id = p_asset_id;
  ELSIF p_result = 'missing' THEN
    IF v_hold.status <> 'pending' THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.footage_file_holds
    SET status = 'missing',
        updated_at = now()
    WHERE asset_id = p_asset_id;
  ELSIF p_result = 'back' THEN
    IF v_hold.phase <> 'restore' OR v_hold.status <> 'pending' OR v_deleted IS NOT NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.footage_file_holds
    SET status = 'back',
        updated_at = now()
    WHERE asset_id = p_asset_id;
  ELSE
    IF v_hold.phase <> 'hide' OR v_hold.status <> 'held' OR v_deleted IS NULL
       OR v_deleted > now() - public.catalog_media_grace() THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.footage_file_holds
    SET status = 'purged',
        updated_at = now()
    WHERE asset_id = p_asset_id;
  END IF;

  RETURN jsonb_build_object('saved', true, 'asset_id', p_asset_id, 'result', p_result);
END;
$task_done$;

REVOKE ALL ON FUNCTION public.catalog_queue_footage_hide(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_queue_footage_restore(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_queue_footage_hide(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.catalog_queue_footage_restore(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.catalog_hide_footage(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_restore_footage(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_list_hidden_footage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_hide_footage(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_restore_footage(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_list_hidden_footage(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.agent_footage_file_tasks(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_footage_file_task_done(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_file_tasks(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_footage_file_task_done(uuid, uuid, text, text) TO service_role;
