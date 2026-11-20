-- Permanent storyboard row ids. VO clips and images keep shot_id when a row is
-- inserted or deleted. row_index stays as the current position.

CREATE TABLE IF NOT EXISTS public.brief_storyboard_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans(id) ON DELETE CASCADE,
  row_index integer NOT NULL CHECK (row_index >= 0),
  CONSTRAINT brief_storyboard_shots_plan_row_unique UNIQUE (social_media_plan_id, row_index)
);

CREATE INDEX IF NOT EXISTS brief_storyboard_shots_plan_idx
  ON public.brief_storyboard_shots (social_media_plan_id, row_index);

COMMENT ON TABLE public.brief_storyboard_shots IS
  'Permanent id for one storyboard row. row_index is only the current position.';

ALTER TABLE public.brief_voice_clips
  ADD COLUMN IF NOT EXISTS shot_id uuid NULL REFERENCES public.brief_storyboard_shots(id) ON DELETE SET NULL;

ALTER TABLE public.brief_storyboard_images
  ADD COLUMN IF NOT EXISTS shot_id uuid NULL REFERENCES public.brief_storyboard_shots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS brief_voice_clips_shot_idx
  ON public.brief_voice_clips (shot_id)
  WHERE shot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS brief_storyboard_images_shot_idx
  ON public.brief_storyboard_images (shot_id)
  WHERE shot_id IS NOT NULL;

ALTER TABLE public.brief_storyboard_shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brief_storyboard_shots_select ON public.brief_storyboard_shots;
CREATE POLICY brief_storyboard_shots_select
  ON public.brief_storyboard_shots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans AS plan
      WHERE plan.id = brief_storyboard_shots.social_media_plan_id
        AND plan.organization_id IN (SELECT public.user_organization_ids())
    )
  );

REVOKE ALL ON TABLE public.brief_storyboard_shots FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.brief_storyboard_shots TO authenticated;
GRANT ALL ON TABLE public.brief_storyboard_shots TO service_role;

CREATE OR REPLACE FUNCTION public.assign_brief_voice_clip_shot_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'vo' AND NEW.shot_id IS NULL THEN
    SELECT shot.id
      INTO NEW.shot_id
    FROM public.brief_storyboard_shots AS shot
    WHERE shot.social_media_plan_id = NEW.social_media_plan_id
      AND shot.row_index = NEW.row_index;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brief_voice_clips_assign_shot_id ON public.brief_voice_clips;
CREATE TRIGGER brief_voice_clips_assign_shot_id
  BEFORE INSERT ON public.brief_voice_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_brief_voice_clip_shot_id();

CREATE OR REPLACE FUNCTION public.ensure_brief_storyboard_shots(
  p_plan_id uuid,
  p_row_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_index integer;
BEGIN
  IF p_plan_id IS NULL OR p_row_count IS NULL OR p_row_count < 0 OR p_row_count > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_edit_content_brief_field(p_plan_id, 'brief_storyboard') THEN
    RAISE EXCEPTION 'brief_field_forbidden' USING ERRCODE = 'P0001', DETAIL = 'brief_storyboard';
  END IF;

  PERFORM 1
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.brief_storyboard_shots AS shot
  WHERE shot.social_media_plan_id = p_plan_id;

  IF v_count = 0 AND p_row_count > 0 THEN
    FOR v_index IN 0..(p_row_count - 1) LOOP
      INSERT INTO public.brief_storyboard_shots (social_media_plan_id, row_index)
      VALUES (p_plan_id, v_index);
    END LOOP;
  ELSIF v_count IS DISTINCT FROM p_row_count THEN
    RAISE EXCEPTION 'brief_shot_mismatch' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.brief_voice_clips AS clip
  SET shot_id = shot.id
  FROM public.brief_storyboard_shots AS shot
  WHERE clip.social_media_plan_id = p_plan_id
    AND shot.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
    AND clip.shot_id IS NULL
    AND clip.row_index = shot.row_index;

  UPDATE public.brief_storyboard_images AS image
  SET shot_id = shot.id
  FROM public.brief_storyboard_shots AS shot
  WHERE image.social_media_plan_id = p_plan_id
    AND shot.social_media_plan_id = p_plan_id
    AND image.column_index = 1
    AND image.shot_id IS NULL
    AND image.row_index = shot.row_index;
END;
$$;

COMMENT ON FUNCTION public.ensure_brief_storyboard_shots(uuid, integer) IS
  'Create permanent storyboard row ids once, then attach clips and images that still use only row_index.';

CREATE OR REPLACE FUNCTION public.move_brief_storyboard_row(
  p_plan_id uuid,
  p_action text,
  p_row_index integer
)
RETURNS TABLE (storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_index integer;
  v_shot uuid;
BEGIN
  IF p_plan_id IS NULL
     OR p_row_index IS NULL
     OR p_row_index < 0
     OR p_action NOT IN ('insert', 'delete') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_edit_content_brief_field(p_plan_id, 'brief_storyboard') THEN
    RAISE EXCEPTION 'brief_field_forbidden' USING ERRCODE = 'P0001', DETAIL = 'brief_storyboard';
  END IF;

  PERFORM 1
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.brief_storyboard_shots AS shot
  WHERE shot.social_media_plan_id = p_plan_id;

  IF p_action = 'insert' AND v_count = 0 AND p_row_index = 0 THEN
    INSERT INTO public.brief_storyboard_shots (social_media_plan_id, row_index)
    VALUES (p_plan_id, 0);
    RETURN;
  END IF;

  IF v_count = 0 OR (p_action = 'insert' AND p_row_index > v_count) OR (p_action = 'delete' AND p_row_index >= v_count) THEN
    RAISE EXCEPTION 'brief_shot_mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF p_action = 'insert' THEN
    FOR v_index IN
      SELECT shot.row_index
      FROM public.brief_storyboard_shots AS shot
      WHERE shot.social_media_plan_id = p_plan_id
        AND shot.row_index >= p_row_index
      ORDER BY shot.row_index DESC
    LOOP
      UPDATE public.brief_storyboard_shots AS shot
      SET row_index = shot.row_index + 1
      WHERE shot.social_media_plan_id = p_plan_id
        AND shot.row_index = v_index;
    END LOOP;

    FOR v_index IN
      SELECT DISTINCT image.row_index
      FROM public.brief_storyboard_images AS image
      WHERE image.social_media_plan_id = p_plan_id
        AND image.column_index = 1
        AND image.row_index >= p_row_index
      ORDER BY image.row_index DESC
    LOOP
      UPDATE public.brief_storyboard_images AS image
      SET row_index = image.row_index + 1
      WHERE image.social_media_plan_id = p_plan_id
        AND image.column_index = 1
        AND image.row_index = v_index;
    END LOOP;

    FOR v_index IN
      SELECT DISTINCT clip.row_index
      FROM public.brief_voice_clips AS clip
      WHERE clip.social_media_plan_id = p_plan_id
        AND clip.kind = 'vo'
        AND clip.row_index >= p_row_index
      ORDER BY clip.row_index DESC
    LOOP
      UPDATE public.brief_voice_clips AS clip
      SET row_index = clip.row_index + 1
      WHERE clip.social_media_plan_id = p_plan_id
        AND clip.kind = 'vo'
        AND clip.row_index = v_index;
    END LOOP;

    INSERT INTO public.brief_storyboard_shots (social_media_plan_id, row_index)
    VALUES (p_plan_id, p_row_index);
    RETURN;
  END IF;

  SELECT shot.id
    INTO v_shot
  FROM public.brief_storyboard_shots AS shot
  WHERE shot.social_media_plan_id = p_plan_id
    AND shot.row_index = p_row_index;

  RETURN QUERY
  SELECT clip.storage_path
  FROM public.brief_voice_clips AS clip
  WHERE clip.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
    AND (clip.shot_id = v_shot OR (clip.shot_id IS NULL AND clip.row_index = p_row_index));

  DELETE FROM public.brief_voice_clips AS clip
  WHERE clip.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
    AND (clip.shot_id = v_shot OR (clip.shot_id IS NULL AND clip.row_index = p_row_index));

  DELETE FROM public.brief_storyboard_images AS image
  WHERE image.social_media_plan_id = p_plan_id
    AND image.column_index = 1
    AND (image.shot_id = v_shot OR (image.shot_id IS NULL AND image.row_index = p_row_index));

  DELETE FROM public.brief_storyboard_shots AS shot
  WHERE shot.id = v_shot;

  FOR v_index IN
    SELECT shot.row_index
    FROM public.brief_storyboard_shots AS shot
    WHERE shot.social_media_plan_id = p_plan_id
      AND shot.row_index > p_row_index
    ORDER BY shot.row_index ASC
  LOOP
    UPDATE public.brief_storyboard_shots AS shot
    SET row_index = shot.row_index - 1
    WHERE shot.social_media_plan_id = p_plan_id
      AND shot.row_index = v_index;
  END LOOP;

  FOR v_index IN
    SELECT DISTINCT image.row_index
    FROM public.brief_storyboard_images AS image
    WHERE image.social_media_plan_id = p_plan_id
      AND image.column_index = 1
      AND image.row_index > p_row_index
    ORDER BY image.row_index ASC
  LOOP
    UPDATE public.brief_storyboard_images AS image
    SET row_index = image.row_index - 1
    WHERE image.social_media_plan_id = p_plan_id
      AND image.column_index = 1
      AND image.row_index = v_index;
  END LOOP;

  FOR v_index IN
    SELECT DISTINCT clip.row_index
    FROM public.brief_voice_clips AS clip
    WHERE clip.social_media_plan_id = p_plan_id
      AND clip.kind = 'vo'
      AND clip.row_index > p_row_index
    ORDER BY clip.row_index ASC
  LOOP
    UPDATE public.brief_voice_clips AS clip
    SET row_index = clip.row_index - 1
    WHERE clip.social_media_plan_id = p_plan_id
      AND clip.kind = 'vo'
      AND clip.row_index = v_index;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.move_brief_storyboard_row(uuid, text, integer) IS
  'Insert or delete one storyboard row. Surviving VO clips and images keep shot_id. Returns storage paths of removed VO clips.';

REVOKE ALL ON FUNCTION public.ensure_brief_storyboard_shots(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_brief_storyboard_shots(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.move_brief_storyboard_row(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_brief_storyboard_row(uuid, text, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.mcp_list_brief_voice_clips(uuid, uuid, uuid);

CREATE FUNCTION public.mcp_list_brief_voice_clips(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid
)
RETURNS TABLE(
  id uuid,
  kind text,
  row_index integer,
  shot_id uuid,
  file_name text,
  spoken_text text,
  storage_path text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL THEN
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans plan
    WHERE plan.id = p_plan_id
      AND plan.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    clip.id,
    clip.kind,
    clip.row_index,
    clip.shot_id,
    clip.file_name,
    clip.spoken_text,
    clip.storage_path,
    clip.created_at
  FROM public.brief_voice_clips clip
  WHERE clip.organization_id = p_organization_id
    AND clip.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
  ORDER BY clip.row_index ASC, clip.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) IS
  'MCP content.briefs.voice.list: VO clips for one plan, including the permanent shot_id.';

NOTIFY pgrst, 'reload schema';
