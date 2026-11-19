-- Snapshot of a content brief before it is overwritten.
-- One row is the storyboard, concept, caption, and link reference together.
-- Clients may read history. Writes go through the functions below.

CREATE TABLE IF NOT EXISTS public.content_brief_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  brief text NULL,
  concept text NULL,
  caption text NULL,
  link_reference text NULL,
  content_hash text NOT NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'mcp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_brief_versions_plan_version_key UNIQUE (social_media_plan_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_content_brief_versions_plan
  ON public.content_brief_versions (social_media_plan_id, version_no DESC);

COMMENT ON TABLE public.content_brief_versions IS
  'Previous content-brief snapshots. source is office today; mcp is reserved for a later edit tool.';

ALTER TABLE public.content_brief_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_brief_versions_select_org ON public.content_brief_versions;
CREATE POLICY content_brief_versions_select_org
  ON public.content_brief_versions
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.content_brief_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.content_brief_versions TO authenticated;

CREATE OR REPLACE FUNCTION public.record_content_brief_version(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_hash text;
  v_last_hash text;
  v_next integer;
  v_id uuid;
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  SELECT plan.organization_id, plan.brief
    INTO v_org, v_brief
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_org NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  SELECT audience.description
    INTO v_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = p_plan_id;

  SELECT caption.content
    INTO v_caption
  FROM public.brief_captions AS caption
  WHERE caption.social_media_plan_id = p_plan_id;

  SELECT link_ref.content
    INTO v_link
  FROM public.brief_link_references AS link_ref
  WHERE link_ref.social_media_plan_id = p_plan_id;

  v_hash := md5(
    CASE WHEN v_brief IS NULL THEN 'N' ELSE 'T' || v_brief END
    || E'\x1f' ||
    CASE WHEN v_concept IS NULL THEN 'N' ELSE 'T' || v_concept END
    || E'\x1f' ||
    CASE WHEN v_caption IS NULL THEN 'N' ELSE 'T' || v_caption END
    || E'\x1f' ||
    CASE WHEN v_link IS NULL THEN 'N' ELSE 'T' || v_link END
  );

  SELECT versions.content_hash
    INTO v_last_hash
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id
  ORDER BY versions.version_no DESC
  LIMIT 1;

  IF v_last_hash IS NOT NULL AND v_last_hash = v_hash THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(MAX(versions.version_no), 0) + 1
    INTO v_next
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  INSERT INTO public.content_brief_versions (
    organization_id,
    social_media_plan_id,
    version_no,
    brief,
    concept,
    caption,
    link_reference,
    content_hash,
    created_by,
    source
  ) VALUES (
    v_org,
    p_plan_id,
    v_next,
    v_brief,
    v_concept,
    v_caption,
    v_link,
    v_hash,
    auth.uid(),
    'office'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_content_brief_version(uuid) IS
  'Copy the live brief into history when it differs from the latest snapshot. Returns null when nothing changed.';

CREATE OR REPLACE FUNCTION public.restore_content_brief_version(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_recorded uuid;
BEGIN
  IF p_version_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;

  SELECT versions.social_media_plan_id,
         versions.brief,
         versions.concept,
         versions.caption,
         versions.link_reference
    INTO v_plan, v_brief, v_concept, v_caption, v_link
  FROM public.content_brief_versions AS versions
  WHERE versions.id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_plan_pic(v_plan) THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;

  v_recorded := public.record_content_brief_version(v_plan);

  UPDATE public.social_media_plans
  SET brief = v_brief
  WHERE id = v_plan;

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description, updated_at)
  VALUES (v_plan, v_concept, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = now();

  INSERT INTO public.brief_captions (social_media_plan_id, content, updated_at)
  VALUES (v_plan, v_caption, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  INSERT INTO public.brief_link_references (social_media_plan_id, content, updated_at)
  VALUES (v_plan, v_link, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  RETURN v_recorded;
END;
$$;

COMMENT ON FUNCTION public.restore_content_brief_version(uuid) IS
  'PIC only. Snapshot the live brief, then write the chosen version. Does not change status, approval, or completion.';

REVOKE ALL ON FUNCTION public.record_content_brief_version(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_content_brief_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_content_brief_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_content_brief_version(uuid) TO authenticated;
