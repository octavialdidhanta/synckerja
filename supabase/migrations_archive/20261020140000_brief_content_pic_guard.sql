-- Only the content-row PIC may change brief text or storyboard images.

CREATE OR REPLACE FUNCTION public.is_plan_pic(plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.social_media_plans AS plan
    JOIN public.employees AS employee ON employee.id = plan.pic_id
    WHERE plan.id = plan_id
      AND employee.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_plan_pic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_plan_pic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_social_media_plan_brief_pic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.brief IS DISTINCT FROM OLD.brief AND NOT public.is_plan_pic(OLD.id) THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_social_media_plan_brief_pic() FROM PUBLIC;

DROP TRIGGER IF EXISTS social_media_plans_brief_pic_guard ON public.social_media_plans;
CREATE TRIGGER social_media_plans_brief_pic_guard
BEFORE UPDATE ON public.social_media_plans
FOR EACH ROW
EXECUTE FUNCTION public.guard_social_media_plan_brief_pic();

DROP POLICY IF EXISTS "brief_storyboard_images_org_all" ON public.brief_storyboard_images;
DROP POLICY IF EXISTS "brief_storyboard_images_org_select" ON public.brief_storyboard_images;
DROP POLICY IF EXISTS "brief_storyboard_images_pic_insert" ON public.brief_storyboard_images;
DROP POLICY IF EXISTS "brief_storyboard_images_pic_update" ON public.brief_storyboard_images;
DROP POLICY IF EXISTS "brief_storyboard_images_pic_delete" ON public.brief_storyboard_images;

CREATE POLICY "brief_storyboard_images_org_select" ON public.brief_storyboard_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans AS plan
      WHERE plan.id = brief_storyboard_images.social_media_plan_id
        AND plan.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "brief_storyboard_images_pic_insert" ON public.brief_storyboard_images
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_plan_pic(social_media_plan_id)
    AND EXISTS (
      SELECT 1
      FROM public.social_media_plans AS plan
      WHERE plan.id = brief_storyboard_images.social_media_plan_id
        AND plan.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "brief_storyboard_images_pic_update" ON public.brief_storyboard_images
  FOR UPDATE TO authenticated
  USING (public.is_plan_pic(social_media_plan_id))
  WITH CHECK (
    public.is_plan_pic(social_media_plan_id)
    AND EXISTS (
      SELECT 1
      FROM public.social_media_plans AS plan
      WHERE plan.id = brief_storyboard_images.social_media_plan_id
        AND plan.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "brief_storyboard_images_pic_delete" ON public.brief_storyboard_images
  FOR DELETE TO authenticated
  USING (public.is_plan_pic(social_media_plan_id));
