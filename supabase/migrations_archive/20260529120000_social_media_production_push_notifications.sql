-- Social media production review notifications (approve / request revision / revision submitted):
-- - In-app bell: social_media_production_notifications
-- - FCM queue: social_media_production_push_queue (webhook → social-media-production-send-push)

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_media_production_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  review_token text NULL,
  event_type text NOT NULL CHECK (event_type IN ('approved', 'revision_requested', 'revision_submitted')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/digital-marketing/social-media/dashboard',
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_prod_notif_user_read
  ON public.social_media_production_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_sm_prod_notif_user_created
  ON public.social_media_production_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sm_prod_notif_plan
  ON public.social_media_production_notifications (social_media_plan_id);

ALTER TABLE public.social_media_production_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_media_production_notifications_select_own" ON public.social_media_production_notifications;
CREATE POLICY "social_media_production_notifications_select_own"
  ON public.social_media_production_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "social_media_production_notifications_update_own" ON public.social_media_production_notifications;
CREATE POLICY "social_media_production_notifications_update_own"
  ON public.social_media_production_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.social_media_production_notifications IS
  'In-app bell for production approve / revision events on social media plans.';

-- ---------------------------------------------------------------------------
-- FCM push queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_media_production_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,

  event_type text NOT NULL CHECK (event_type IN ('approved', 'revision_requested', 'revision_submitted')),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  review_token text NULL,

  actor_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  assignee_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  assigner_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  plan_title text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/digital-marketing/social-media/dashboard'
);

CREATE INDEX IF NOT EXISTS idx_sm_prod_push_queue_unsent_recipient
  ON public.social_media_production_push_queue (recipient_user_id, created_at DESC)
  WHERE sent_at IS NULL;

ALTER TABLE public.social_media_production_push_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_media_production_push_queue_select_own" ON public.social_media_production_push_queue;
CREATE POLICY "social_media_production_push_queue_select_own"
  ON public.social_media_production_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

COMMENT ON TABLE public.social_media_production_push_queue IS
  'Queue for FCM pushes on social media production approve/revision events.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_production_status(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(p_status, '')));
$$;

CREATE OR REPLACE FUNCTION public.is_production_status_revision_requested(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.norm_production_status(p_status) IN ('request revision', 'request revisi');
$$;

CREATE OR REPLACE FUNCTION public.is_production_status_need_review(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.norm_production_status(p_status) = 'need review';
$$;

CREATE OR REPLACE FUNCTION public.is_production_status_approved(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.norm_production_status(p_status) = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.latest_review_token_for_plan(p_plan_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT prt.token
  FROM public.public_review_tokens prt
  WHERE prt.social_media_plan_id = p_plan_id
  ORDER BY prt.created_at DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_production_assignee_user_id(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pic_production_id uuid;
  v_step_assignee uuid;
BEGIN
  SELECT pic_production_id INTO v_pic_production_id
  FROM public.social_media_plans
  WHERE id = p_plan_id;

  IF v_pic_production_id IS NOT NULL THEN
    RETURN public.employee_user_id(v_pic_production_id);
  END IF;

  SELECT tsa.employee_id INTO v_step_assignee
  FROM public.task_steps ts
  JOIN public.task_steps_assigned tsa ON tsa.task_step_id = ts.id
  WHERE ts.social_media_plan_id = p_plan_id
  ORDER BY tsa.assigned_at DESC NULLS LAST
  LIMIT 1;

  RETURN public.employee_user_id(v_step_assignee);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_production_assigner_user_id(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_creator uuid;
  v_pic_id uuid;
BEGIN
  SELECT prt.created_by INTO v_token_creator
  FROM public.public_review_tokens prt
  WHERE prt.social_media_plan_id = p_plan_id
  ORDER BY prt.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_token_creator IS NOT NULL THEN
    RETURN v_token_creator;
  END IF;

  SELECT pic_id INTO v_pic_id
  FROM public.social_media_plans
  WHERE id = p_plan_id;

  RETURN public.employee_user_id(v_pic_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.production_review_url_for_assignee()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '/tools/daily-task?view=jobdesc'::text;
$$;

CREATE OR REPLACE FUNCTION public.production_review_url_for_assigner(p_plan_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.latest_review_token_for_plan(p_plan_id);
  IF v_token IS NOT NULL AND btrim(v_token) <> '' THEN
    RETURN '/review/' || btrim(v_token);
  END IF;
  RETURN '/digital-marketing/social-media/dashboard';
END;
$$;

CREATE OR REPLACE FUNCTION public.user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'User')::text
      FROM public.employees e
      WHERE e.user_id = p_user_id
      LIMIT 1
    ),
    'User'
  );
$$;

-- ---------------------------------------------------------------------------
-- Insert bell + queue
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Trigger on social_media_plans
-- ---------------------------------------------------------------------------
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
  v_token text;
  v_title text;
  v_url text;
  v_event text;
  v_old_status text;
  v_new_status text;
  v_was_approved boolean;
  v_is_approved boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  v_old_status := public.norm_production_status(OLD.production_status);
  v_new_status := public.norm_production_status(NEW.production_status);
  v_was_approved := COALESCE(OLD.production_approved, false);
  v_is_approved := COALESCE(NEW.production_approved, false);

  v_title := COALESCE(NULLIF(btrim(NEW.title), ''), 'Konten');
  v_token := public.latest_review_token_for_plan(NEW.id);
  v_assignee := public.resolve_production_assignee_user_id(NEW.id);
  v_assigner := public.resolve_production_assigner_user_id(NEW.id);

  v_event := NULL;

  -- Approved: flag turned on or status became Approved
  IF (NOT v_was_approved AND v_is_approved)
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

  -- Request revision
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

  -- Revision submitted (back to Need Review from Request Revision)
  IF public.is_production_status_revision_requested(OLD.production_status)
     AND public.is_production_status_need_review(NEW.production_status) THEN
    v_event := 'revision_submitted';
    v_url := public.production_review_url_for_assigner(NEW.id);
    PERFORM public.insert_social_media_production_notification(
      v_assigner, NEW.organization_id, v_event, NEW.id, v_token,
      v_actor, v_assignee, v_assigner, v_title, v_url
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_media_plans_production_notify ON public.social_media_plans;
CREATE TRIGGER trg_social_media_plans_production_notify
  AFTER UPDATE OF production_status, production_approved, production_completion_date
  ON public.social_media_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_social_media_plans_production_notify();

-- ---------------------------------------------------------------------------
-- Mark read RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_social_media_production_notifications_read(
  notification_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF notification_ids IS NULL OR array_length(notification_ids, 1) IS NULL THEN
    UPDATE public.social_media_production_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND read_at IS NULL;
  ELSE
    UPDATE public.social_media_production_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND id = ANY(notification_ids);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.mark_social_media_production_notifications_read(uuid[]) IS
  'Mark production review notifications as read for current user.';

-- ---------------------------------------------------------------------------
-- Claim RPC for edge function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_social_media_production_push_queue(
  p_recipient_user_id uuid,
  p_window_seconds integer DEFAULT 20,
  p_max integer DEFAULT 25
)
RETURNS SETOF public.social_media_production_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.social_media_production_push_queue q
    WHERE q.recipient_user_id = p_recipient_user_id
      AND q.sent_at IS NULL
      AND q.created_at >= now() - make_interval(secs => GREATEST(1, p_window_seconds))
    ORDER BY q.created_at DESC
    LIMIT GREATEST(1, p_max)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.social_media_production_push_queue q
    SET sent_at = now()
    FROM candidates c
    WHERE q.id = c.id
      AND q.sent_at IS NULL
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;

-- Realtime for in-app bell
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_media_production_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
