-- Fase 3 Design Story: list plan Story milik AI employee (UI di bawah Riwayat Run).

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
        'google_drive_link', left(COALESCE(plan.google_drive_link, ''), 500)
      ) AS row_data
    FROM public.social_media_plans plan
    JOIN public.content_types ctype
      ON ctype.id = plan.content_type_id
     AND lower(btrim(ctype.name)) = 'story'
    LEFT JOIN public.employees pic
      ON pic.id = plan.pic_id
    LEFT JOIN public.services service
      ON service.id = plan.service_id
    LEFT JOIN public.content_pillars pillar
      ON pillar.id = plan.content_pillar_id
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

COMMENT ON FUNCTION public.ai_employee_story_plans(uuid, date) IS
  'Daftar plan content_type Story milik AI employee untuk satu bulan (Jakarta). Fase 3.';
