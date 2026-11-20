-- Social Media Management: extend stub social_media_plans, master data, links, public review RPCs.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where applicable.

-- ---------------------------------------------------------------------------
-- Master data (org-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_types_org ON public.content_types (organization_id);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_org ON public.services (organization_id);

CREATE TABLE IF NOT EXISTS public.sub_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_services_org ON public.sub_services (organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_services_service ON public.sub_services (service_id);

CREATE TABLE IF NOT EXISTS public.content_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  funnel_stage text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_pillars_org ON public.content_pillars (organization_id);

-- ---------------------------------------------------------------------------
-- social_media_plans: add columns expected by dashboard (stub may already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS post_date timestamptz;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS content_type_id uuid REFERENCES public.content_types (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS pic_id uuid REFERENCES public.employees (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS sub_service_id uuid REFERENCES public.sub_services (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS content_pillar_id uuid REFERENCES public.content_pillars (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS brief text;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS completion_date timestamptz;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS pic_production_id uuid REFERENCES public.employees (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS pic_production_source text;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS google_drive_link text;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS production_revision_baseline_link text;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS production_revision_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS production_completion_date timestamptz;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS production_approved_date timestamptz;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS post_link jsonb;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS post_link_created_by uuid REFERENCES public.employees (id) ON DELETE SET NULL;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS actual_post_date date;
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS on_time_status text NOT NULL DEFAULT '';
ALTER TABLE public.social_media_plans ADD COLUMN IF NOT EXISTS status_content text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- social_media_links & social_media_names
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  social_media_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_media_links_plan ON public.social_media_links (social_media_plan_id);

CREATE TABLE IF NOT EXISTS public.social_media_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_media_names_org ON public.social_media_names (organization_id);

CREATE TABLE IF NOT EXISTS public.service_required_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services (id) ON DELETE CASCADE,
  platform text,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_required_platforms_org ON public.service_required_platforms (organization_id);

-- ---------------------------------------------------------------------------
-- Brief sections (one row per plan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brief_target_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brief_target_audiences_plan_unique UNIQUE (social_media_plan_id)
);

CREATE TABLE IF NOT EXISTS public.brief_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brief_captions_plan_unique UNIQUE (social_media_plan_id)
);

CREATE TABLE IF NOT EXISTS public.brief_link_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brief_link_references_plan_unique UNIQUE (social_media_plan_id)
);

-- ---------------------------------------------------------------------------
-- Public review: tokens + comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.link_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  link_url text NOT NULL,
  comment_text text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  commenter_display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  video_timestamp_seconds numeric,
  annotation_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_link_comments_plan ON public.link_comments (social_media_plan_id);

CREATE TABLE IF NOT EXISTS public.public_review_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  link_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_review_tokens_token ON public.public_review_tokens (token);
CREATE INDEX IF NOT EXISTS idx_public_review_tokens_plan_link ON public.public_review_tokens (social_media_plan_id, link_url);

-- ---------------------------------------------------------------------------
-- RLS (align with org membership helper)
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_required_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_target_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_link_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_review_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_types_org" ON public.content_types;
CREATE POLICY "content_types_org" ON public.content_types FOR ALL TO authenticated USING (
  organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (
  organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
);

DROP POLICY IF EXISTS "services_org" ON public.services;
CREATE POLICY "services_org" ON public.services FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sub_services_org" ON public.sub_services;
CREATE POLICY "sub_services_org" ON public.sub_services FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "content_pillars_org" ON public.content_pillars;
CREATE POLICY "content_pillars_org" ON public.content_pillars FOR ALL TO authenticated USING (
  organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (
  organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
);

DROP POLICY IF EXISTS "social_media_links_org" ON public.social_media_links;
CREATE POLICY "social_media_links_org" ON public.social_media_links FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = social_media_links.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = social_media_links.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

DROP POLICY IF EXISTS "social_media_names_org" ON public.social_media_names;
CREATE POLICY "social_media_names_org" ON public.social_media_names FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "service_required_platforms_org" ON public.service_required_platforms;
CREATE POLICY "service_required_platforms_org" ON public.service_required_platforms FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "brief_target_audiences_org" ON public.brief_target_audiences;
CREATE POLICY "brief_target_audiences_org" ON public.brief_target_audiences FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_target_audiences.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_target_audiences.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

DROP POLICY IF EXISTS "brief_captions_org" ON public.brief_captions;
CREATE POLICY "brief_captions_org" ON public.brief_captions FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_captions.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_captions.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

DROP POLICY IF EXISTS "brief_link_references_org" ON public.brief_link_references;
CREATE POLICY "brief_link_references_org" ON public.brief_link_references FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_link_references.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = brief_link_references.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

DROP POLICY IF EXISTS "link_comments_org" ON public.link_comments;
CREATE POLICY "link_comments_org" ON public.link_comments FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = link_comments.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = link_comments.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

DROP POLICY IF EXISTS "public_review_tokens_org" ON public.public_review_tokens;
CREATE POLICY "public_review_tokens_org" ON public.public_review_tokens FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = public_review_tokens.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.social_media_plans smp
    WHERE smp.id = public_review_tokens.social_media_plan_id
      AND smp.organization_id IN (SELECT public.user_organization_ids())
  )
);

-- ---------------------------------------------------------------------------
-- RPCs: public review (SECURITY DEFINER — callable by anon for guest QC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_review_content_by_token (token_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_link_url text;
  v_result json;
BEGIN
  SELECT social_media_plan_id, link_url INTO v_plan_id, v_link_url
  FROM public.public_review_tokens
  WHERE token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'social_media_plan_id', smp.id,
    'link_url', v_link_url,
    'title', smp.title,
    'post_date', smp.post_date,
    'google_drive_link', smp.google_drive_link,
    'content_type_name', ct.name,
    'service_name', s.name,
    'sub_service_name', ss.name
  ) INTO v_result
  FROM public.social_media_plans smp
  LEFT JOIN public.content_types ct ON ct.id = smp.content_type_id
  LEFT JOIN public.services s ON s.id = smp.service_id
  LEFT JOIN public.sub_services ss ON ss.id = smp.sub_service_id
  WHERE smp.id = v_plan_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_review_comments (token_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_link_url text;
  v_comments json;
BEGIN
  SELECT social_media_plan_id, link_url INTO v_plan_id, v_link_url
  FROM public.public_review_tokens
  WHERE token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', lc.id,
      'social_media_plan_id', lc.social_media_plan_id,
      'link_url', lc.link_url,
      'comment_text', lc.comment_text,
      'created_by', lc.created_by,
      'created_at', lc.created_at,
      'updated_at', lc.updated_at,
      'video_timestamp_seconds', lc.video_timestamp_seconds,
      'annotation_data', lc.annotation_data,
      'creator_display_name', CASE
        WHEN lc.commenter_display_name IS NOT NULL AND trim(lc.commenter_display_name) <> '' THEN trim(lc.commenter_display_name)
        WHEN lc.created_by IS NOT NULL THEN COALESCE((SELECT p.full_name FROM public.profiles p WHERE p.user_id = lc.created_by LIMIT 1), 'Unknown')
        ELSE 'Anonim'
      END
    ) ORDER BY lc.created_at ASC
  ), '[]'::json) INTO v_comments
  FROM public.link_comments lc
  WHERE lc.social_media_plan_id = v_plan_id
    AND lc.link_url = v_link_url;

  RETURN v_comments;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_public_review_comment (
  token_param text,
  comment_text text,
  commenter_display_name text,
  video_timestamp_seconds numeric DEFAULT NULL,
  annotation_data jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_link_url text;
  v_inserted_id uuid;
  v_inserted_row public.link_comments%ROWTYPE;
  v_name text;
BEGIN
  IF comment_text IS NULL OR trim(comment_text) = '' THEN
    RAISE EXCEPTION 'comment_text is required';
  END IF;

  v_name := trim(commenter_display_name);
  IF v_name = '' THEN
    RAISE EXCEPTION 'commenter_display_name is required';
  END IF;

  SELECT social_media_plan_id, link_url INTO v_plan_id, v_link_url
  FROM public.public_review_tokens
  WHERE token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired review link';
  END IF;

  INSERT INTO public.link_comments (
    social_media_plan_id,
    link_url,
    comment_text,
    created_by,
    commenter_display_name,
    video_timestamp_seconds,
    annotation_data
  ) VALUES (
    v_plan_id,
    v_link_url,
    trim(comment_text),
    NULL,
    v_name,
    video_timestamp_seconds,
    annotation_data
  )
  RETURNING id INTO v_inserted_id;

  SELECT * INTO v_inserted_row FROM public.link_comments WHERE id = v_inserted_id;

  RETURN json_build_object(
    'id', v_inserted_row.id,
    'social_media_plan_id', v_inserted_row.social_media_plan_id,
    'link_url', v_inserted_row.link_url,
    'comment_text', v_inserted_row.comment_text,
    'created_by', v_inserted_row.created_by,
    'created_at', v_inserted_row.created_at,
    'updated_at', v_inserted_row.updated_at,
    'video_timestamp_seconds', v_inserted_row.video_timestamp_seconds,
    'annotation_data', v_inserted_row.annotation_data,
    'creator_display_name', v_inserted_row.commenter_display_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_public_review_comment (
  comment_id uuid,
  token_param text,
  commenter_display_name text,
  new_comment_text text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_name text;
  v_updated public.link_comments%ROWTYPE;
BEGIN
  IF new_comment_text IS NULL OR trim(new_comment_text) = '' THEN
    RAISE EXCEPTION 'new_comment_text is required';
  END IF;

  v_name := trim(commenter_display_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'commenter_display_name is required';
  END IF;

  SELECT social_media_plan_id INTO v_plan_id
  FROM public.public_review_tokens
  WHERE token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired review link';
  END IF;

  UPDATE public.link_comments
  SET comment_text = trim(new_comment_text),
      updated_at = now()
  WHERE id = comment_id
    AND social_media_plan_id = v_plan_id
    AND created_by IS NULL
    AND trim(COALESCE(commenter_display_name, '')) = v_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you are not the author';
  END IF;

  SELECT * INTO v_updated FROM public.link_comments WHERE id = comment_id;

  RETURN json_build_object(
    'id', v_updated.id,
    'social_media_plan_id', v_updated.social_media_plan_id,
    'comment_text', v_updated.comment_text,
    'created_by', v_updated.created_by,
    'created_at', v_updated.created_at,
    'updated_at', v_updated.updated_at,
    'video_timestamp_seconds', v_updated.video_timestamp_seconds,
    'annotation_data', v_updated.annotation_data,
    'creator_display_name', v_updated.commenter_display_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_public_review_comment (
  comment_id uuid,
  token_param text,
  commenter_display_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_name text;
BEGIN
  v_name := trim(commenter_display_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'commenter_display_name is required';
  END IF;

  SELECT social_media_plan_id INTO v_plan_id
  FROM public.public_review_tokens
  WHERE token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired review link';
  END IF;

  DELETE FROM public.link_comments
  WHERE id = comment_id
    AND social_media_plan_id = v_plan_id
    AND created_by IS NULL
    AND trim(COALESCE(commenter_display_name, '')) = v_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you are not the author';
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_review_brief_extended_by_token (token_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_ta text;
  v_cap text;
BEGIN
  SELECT prt.social_media_plan_id INTO v_plan_id
  FROM public.public_review_tokens prt
  WHERE prt.token = token_param
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT bta.description INTO v_ta FROM public.brief_target_audiences bta WHERE bta.social_media_plan_id = v_plan_id LIMIT 1;
  SELECT bc.content INTO v_cap FROM public.brief_captions bc WHERE bc.social_media_plan_id = v_plan_id LIMIT 1;

  RETURN json_build_object(
    'target_audience', COALESCE(v_ta, ''),
    'caption', COALESCE(v_cap, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_review_content_by_token (text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_review_comments (text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_public_review_comment (text, text, text, numeric, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_review_comment (uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_public_review_comment (uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_review_brief_extended_by_token (text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Employee targets (content planning KPIs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_category text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  progress_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_targets_org ON public.employee_targets (organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_targets_employee ON public.employee_targets (employee_id);

ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_targets_org" ON public.employee_targets;
CREATE POLICY "employee_targets_org" ON public.employee_targets FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids())
) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- Page access (app): register permission_configurations.page_path = '/digital-marketing/social-media'
-- so non-owner roles receive access per org policy. Owner/admin bypass in useDepartmentAccess.
