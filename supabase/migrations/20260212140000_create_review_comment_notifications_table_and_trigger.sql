-- Table: notifications for new review comments (recipient = creator of review link)
CREATE TABLE IF NOT EXISTS public.review_comment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_comment_id UUID NOT NULL REFERENCES public.link_comments(id) ON DELETE CASCADE,
  social_media_plan_id UUID NOT NULL REFERENCES public.social_media_plans(id) ON DELETE CASCADE,
  review_token TEXT NOT NULL,
  plan_title TEXT,
  commenter_display_name TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comment_notifications_user_id ON public.review_comment_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_review_comment_notifications_user_read ON public.review_comment_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_review_comment_notifications_created_at ON public.review_comment_notifications(created_at DESC);

ALTER TABLE public.review_comment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review comment notifications"
  ON public.review_comment_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own review comment notifications (read_at)"
  ON public.review_comment_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: on new comment, notify each user who created a review token for this plan
CREATE OR REPLACE FUNCTION public.trigger_notify_review_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_plan_title TEXT;
BEGIN
  SELECT token INTO v_token
  FROM public.public_review_tokens
  WHERE social_media_plan_id = NEW.social_media_plan_id
  LIMIT 1;

  SELECT title INTO v_plan_title
  FROM public.social_media_plans
  WHERE id = NEW.social_media_plan_id;

  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.review_comment_notifications (
    user_id,
    link_comment_id,
    social_media_plan_id,
    review_token,
    plan_title,
    commenter_display_name,
    read_at,
    created_at
  )
  SELECT DISTINCT
    prt.created_by,
    NEW.id,
    NEW.social_media_plan_id,
    v_token,
    v_plan_title,
    trim(COALESCE(NEW.commenter_display_name, '')),
    NULL,
    now()
  FROM public.public_review_tokens prt
  WHERE prt.social_media_plan_id = NEW.social_media_plan_id
    AND prt.created_by IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_link_comment_insert_notify ON public.link_comments;
CREATE TRIGGER after_link_comment_insert_notify
  AFTER INSERT ON public.link_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_review_comment();

-- Enable Realtime for the table (add to publication; skip if publication does not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.review_comment_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RPC: mark notifications as read
CREATE OR REPLACE FUNCTION public.mark_review_comment_notifications_read(notification_ids UUID[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF notification_ids IS NULL OR array_length(notification_ids, 1) IS NULL THEN
    UPDATE public.review_comment_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND read_at IS NULL;
  ELSE
    UPDATE public.review_comment_notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND id = ANY(notification_ids);
  END IF;
END;
$$;

COMMENT ON TABLE public.review_comment_notifications IS 'Notifications when someone comments on a public review; recipient = user who created the review link.';
COMMENT ON FUNCTION public.mark_review_comment_notifications_read(UUID[]) IS 'Mark review comment notifications as read for current user.';
