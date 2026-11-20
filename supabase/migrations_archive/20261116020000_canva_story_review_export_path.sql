-- Fase 5: export_path + production_status on Story plan list / Canva status RPCs.

DROP FUNCTION IF EXISTS public.canva_story_status_for_plans(uuid[]);

CREATE FUNCTION public.canva_story_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text,
  images_ready boolean,
  refresh_requested boolean,
  export_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.social_media_plan_id,
         r.status,
         r.design_url,
         left(COALESCE(r.error, ''), 160),
         r.images_ready,
         r.refresh_requested,
         r.export_path
  FROM public.canva_story_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_story_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_employee_story_plans(
  p_employee_id uuid,
  p_month date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_month date;
  v_from timestamptz;
  v_to timestamptz;
  v_rows jsonb;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);
  v_month := date_trunc('month', COALESCE(p_month, timezone('Asia/Jakarta', now())::date))::date;
  v_from := v_month::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_to := (v_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Jakarta';

  SELECT COALESCE(jsonb_agg(row_data ORDER BY post_date DESC NULLS LAST, created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      plan.post_date,
      plan.created_at,
      jsonb_build_object(
        'id', plan.id,
        'post_date', plan.post_date,
        'pic_name', left(COALESCE(pic.full_name, ''), 120),
        'content_type_name', left(COALESCE(ctype.name, 'Story'), 40),
        'service_name', left(COALESCE(service.name, ''), 120),
        'pillar_name', left(COALESCE(pillar.name, ''), 120),
        'brief_preview', left(COALESCE(plan.brief, ''), 280),
        'google_drive_link', left(COALESCE(plan.google_drive_link, ''), 500),
        'production_status', left(COALESCE(plan.production_status, ''), 40),
        'production_approved', COALESCE(plan.production_approved, false),
        'canva', CASE
          WHEN canva.social_media_plan_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'status', canva.status,
            'design_url', canva.design_url,
            'error', left(COALESCE(canva.error, ''), 160),
            'images_ready', canva.images_ready,
            'refresh_requested', canva.refresh_requested,
            'export_path', canva.export_path
          )
        END
      ) AS row_data
    FROM public.social_media_plans plan
    JOIN public.content_types ctype
      ON ctype.id = plan.content_type_id
     AND lower(btrim(ctype.name)) = 'story'
    LEFT JOIN public.employees pic ON pic.id = plan.pic_id
    LEFT JOIN public.services service ON service.id = plan.service_id
    LEFT JOIN public.content_pillars pillar ON pillar.id = plan.content_pillar_id
    LEFT JOIN public.canva_story_runs canva ON canva.social_media_plan_id = plan.id
    WHERE plan.organization_id = v_org
      AND (plan.pic_id = p_employee_id OR plan.author_employee_id = p_employee_id)
      AND plan.post_date >= v_from
      AND plan.post_date < v_to
    ORDER BY plan.post_date DESC NULLS LAST, plan.created_at DESC
    LIMIT 300
  ) listed;

  RETURN jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_story_plans(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_plans(uuid, date) TO authenticated;
