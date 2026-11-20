-- Notify the PIC Production direct manager on the mobile app when a plan
-- is in Production Status Need Review. The table shows Need Review both when
-- the status is stored and when a deliverable exists while the status is empty.

ALTER TABLE public.social_media_production_notifications
  DROP CONSTRAINT IF EXISTS social_media_production_notifications_event_type_check;

ALTER TABLE public.social_media_production_notifications
  ADD CONSTRAINT social_media_production_notifications_event_type_check
  CHECK (event_type = ANY (ARRAY['approved'::text, 'revision_requested'::text, 'revision_submitted'::text, 'need_review'::text]));

ALTER TABLE public.social_media_production_push_queue
  DROP CONSTRAINT IF EXISTS social_media_production_push_queue_event_type_check;

ALTER TABLE public.social_media_production_push_queue
  ADD CONSTRAINT social_media_production_push_queue_event_type_check
  CHECK (event_type = ANY (ARRAY['approved'::text, 'revision_requested'::text, 'revision_submitted'::text, 'need_review'::text]));

CREATE OR REPLACE FUNCTION public.pic_production_manager_user_id(p_plan_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.employee_user_id(employee.manager_id)
  FROM public.social_media_plans plan
  JOIN public.employees employee ON employee.id = plan.pic_production_id
  WHERE plan.id = p_plan_id
    AND employee.manager_id IS NOT NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.pic_production_manager_user_id(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.insert_social_media_production_notification(
  p_recipient_user_id uuid,
  p_organization_id uuid,
  p_event_type text,
  p_social_media_plan_id uuid,
  p_review_token text,
  p_actor_user_id uuid,
  p_assignee_user_id uuid,
  p_assigner_user_id uuid,
  p_plan_title text,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_plan_label text;
  v_actor_name text;
  v_pic_name text;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_actor_user_id IS NOT NULL AND p_recipient_user_id = p_actor_user_id THEN
    RETURN;
  END IF;

  v_plan_label := COALESCE(NULLIF(btrim(p_plan_title), ''), 'Konten');
  v_actor_name := COALESCE(public.user_display_name(p_actor_user_id), 'Reviewer');

  IF p_event_type = 'approved' THEN
    v_title := 'Konten disetujui';
    v_body := v_plan_label || ' telah di-approve oleh ' || v_actor_name || '.';
  ELSIF p_event_type = 'revision_requested' THEN
    v_title := 'Permintaan revisi';
    v_body := v_plan_label || ' perlu revisi. Cek detail di Daily Task / link review.';
  ELSIF p_event_type = 'need_review' THEN
    SELECT COALESCE(NULLIF(btrim(employee.full_name), ''), 'PIC produksi')
    INTO v_pic_name
    FROM public.social_media_plans plan
    JOIN public.employees employee ON employee.id = plan.pic_production_id
    WHERE plan.id = p_social_media_plan_id;
    v_title := 'Produksi perlu direview';
    v_body := v_plan_label || ' dari ' || COALESCE(v_pic_name, 'PIC produksi') || ' menunggu review.';
  ELSE
    v_title := 'Revisi siap direview';
    v_body := v_plan_label || ' sudah dikirim ulang untuk review.';
  END IF;

  INSERT INTO public.social_media_production_notifications (
    user_id, organization_id, social_media_plan_id, review_token,
    event_type, title, body, url, read_at, created_at
  ) VALUES (
    p_recipient_user_id, p_organization_id, p_social_media_plan_id, p_review_token,
    p_event_type, v_title, v_body, p_url, NULL, now()
  );

  INSERT INTO public.social_media_production_push_queue (
    organization_id, recipient_user_id, created_at, sent_at,
    event_type, social_media_plan_id, review_token,
    actor_user_id, assignee_user_id, assigner_user_id,
    plan_title, url
  ) VALUES (
    p_organization_id, p_recipient_user_id, now(), NULL,
    p_event_type, p_social_media_plan_id, p_review_token,
    p_actor_user_id, p_assignee_user_id, p_assigner_user_id,
    COALESCE(p_plan_title, ''), p_url
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.trg_social_media_plans_production_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_assignee uuid;
  v_assigner uuid;
  v_manager uuid;
  v_token text;
  v_title text;
  v_url text;
  v_event text;
  v_type_name text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  v_title := COALESCE(NULLIF(btrim(NEW.title), ''), 'Konten');
  v_token := public.latest_review_token_for_plan(NEW.id);
  v_assignee := public.resolve_production_assignee_user_id(NEW.id);
  v_assigner := public.resolve_production_assigner_user_id(NEW.id);
  v_manager := public.pic_production_manager_user_id(NEW.id);
  v_event := NULL;

  IF (NOT COALESCE(OLD.production_approved, false) AND COALESCE(NEW.production_approved, false))
     OR (NOT public.is_production_status_approved(OLD.production_status)
         AND public.is_production_status_approved(NEW.production_status)) THEN
    v_event := 'approved';
    v_url := public.production_review_url_for_assignee();
    PERFORM public.insert_social_media_production_notification(
      v_assignee, NEW.organization_id, v_event, NEW.id, v_token,
      v_actor, v_assignee, v_assigner, v_title, v_url
    );
    RETURN NEW;
  END IF;

  IF NOT public.is_production_status_revision_requested(OLD.production_status)
     AND public.is_production_status_revision_requested(NEW.production_status) THEN
    v_event := 'revision_requested';
    v_url := public.production_review_url_for_assignee();
    PERFORM public.insert_social_media_production_notification(
      v_assignee, NEW.organization_id, v_event, NEW.id, v_token,
      v_actor, v_assignee, v_assigner, v_title, v_url
    );
    RETURN NEW;
  END IF;

  IF public.is_production_status_need_review(NEW.production_status)
     AND NOT public.is_production_status_need_review(OLD.production_status) THEN
    PERFORM public.notify_pic_production_manager_need_review(NEW.id);
    IF public.is_production_status_revision_requested(OLD.production_status)
       AND v_assigner IS DISTINCT FROM v_manager THEN
      v_event := 'revision_submitted';
      v_url := public.production_review_url_for_assigner(NEW.id);
      PERFORM public.insert_social_media_production_notification(
        v_assigner, NEW.organization_id, v_event, NEW.id, v_token,
        v_actor, v_assignee, v_assigner, v_title, v_url
      );
    END IF;
    RETURN NEW;
  END IF;

  SELECT content_type.name INTO v_type_name
  FROM public.content_types content_type
  WHERE content_type.id = NEW.content_type_id;

  IF COALESCE(v_type_name, '') NOT IN ('Post', 'Carousel')
     AND coalesce(btrim(OLD.google_drive_link), '') = ''
     AND coalesce(btrim(NEW.google_drive_link), '') <> ''
     AND coalesce(btrim(NEW.production_status), '') = ''
     AND COALESCE(NEW.production_approved, false) = false
     AND NOT EXISTS (
       SELECT 1
       FROM public.social_media_production_notifications note
       WHERE note.social_media_plan_id = NEW.id
         AND note.event_type = 'need_review'
     ) THEN
    PERFORM public.notify_pic_production_manager_need_review(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_carousel_images_need_review_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
BEGIN
  FOR v_plan IN
    SELECT DISTINCT inserted.social_media_plan_id
    FROM inserted
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.social_media_plans plan
      JOIN public.content_types content_type ON content_type.id = plan.content_type_id
      WHERE plan.id = v_plan
        AND content_type.name IN ('Post', 'Carousel')
        AND COALESCE(plan.production_approved, false) = false
        AND coalesce(btrim(plan.production_status), '') = ''
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.social_media_production_notifications note
      WHERE note.social_media_plan_id = v_plan
        AND note.event_type = 'need_review'
    ) THEN
      PERFORM public.notify_pic_production_manager_need_review(v_plan);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_carousel_images_need_review_notify ON public.social_media_plan_carousel_images;
CREATE TRIGGER trg_carousel_images_need_review_notify
  AFTER INSERT ON public.social_media_plan_carousel_images
  REFERENCING NEW TABLE AS inserted
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_carousel_images_need_review_notify();

DROP TRIGGER IF EXISTS social_media_production_push_queue_insert ON public.social_media_production_push_queue;
CREATE TRIGGER social_media_production_push_queue_insert
  AFTER INSERT ON public.social_media_production_push_queue
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/social-media-production-send-push',
    'POST',
    '{"Content-type":"application/json"}',
    '{}',
    '10000'
  );

DO $$
DECLARE
  v_plan uuid;
BEGIN
  FOR v_plan IN
    SELECT plan.id
    FROM public.social_media_plans plan
    JOIN public.content_types content_type ON content_type.id = plan.content_type_id
    WHERE COALESCE(plan.production_approved, false) = false
      AND public.pic_production_manager_user_id(plan.id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.social_media_production_notifications note
        WHERE note.social_media_plan_id = plan.id
          AND note.event_type = 'need_review'
      )
      AND (
        public.is_production_status_need_review(plan.production_status)
        OR (
          coalesce(btrim(plan.production_status), '') = ''
          AND (
            (
              content_type.name IN ('Post', 'Carousel')
              AND EXISTS (
                SELECT 1
                FROM public.social_media_plan_carousel_images image
                WHERE image.social_media_plan_id = plan.id
              )
            )
            OR (
              content_type.name NOT IN ('Post', 'Carousel')
              AND coalesce(btrim(plan.google_drive_link), '') <> ''
            )
          )
        )
      )
  LOOP
    PERFORM public.notify_pic_production_manager_need_review(v_plan);
  END LOOP;
END $$;
