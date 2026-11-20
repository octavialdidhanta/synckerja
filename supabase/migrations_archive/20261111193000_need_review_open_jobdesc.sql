-- Need Review push opens Job Desc and names the plan, so the mobile app
-- can show that plan in Pending your approval and open the preview.

CREATE OR REPLACE FUNCTION public.notify_pic_production_manager_need_review(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_title text;
  v_manager uuid;
  v_token text;
  v_assignee uuid;
  v_assigner uuid;
BEGIN
  SELECT plan.organization_id, COALESCE(NULLIF(btrim(plan.title), ''), 'Konten')
  INTO v_org, v_title
  FROM public.social_media_plans plan
  WHERE plan.id = p_plan_id
    AND COALESCE(plan.production_approved, false) = false;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  v_manager := public.pic_production_manager_user_id(p_plan_id);
  IF v_manager IS NULL THEN
    RETURN;
  END IF;

  v_token := public.latest_review_token_for_plan(p_plan_id);
  v_assignee := public.resolve_production_assignee_user_id(p_plan_id);
  v_assigner := public.resolve_production_assigner_user_id(p_plan_id);

  PERFORM public.insert_social_media_production_notification(
    v_manager, v_org, 'need_review', p_plan_id, v_token,
    auth.uid(), v_assignee, v_assigner, v_title,
    '/tools/daily-task?view=jobdesc&productionPlan=' || p_plan_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_pic_production_manager_need_review(uuid) FROM PUBLIC, anon, authenticated;

UPDATE public.social_media_production_notifications
SET url = '/tools/daily-task?view=jobdesc&productionPlan=' || social_media_plan_id::text
WHERE event_type = 'need_review'
  AND url IS DISTINCT FROM '/tools/daily-task?view=jobdesc&productionPlan=' || social_media_plan_id::text;
