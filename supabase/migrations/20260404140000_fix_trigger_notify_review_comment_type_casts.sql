-- Fix PostgreSQL 42804 (datatype_mismatch) on INSERT into link_comments when
-- after_link_comment_insert_notify runs: plan_title must be TEXT but
-- social_media_plans.title may be jsonb or another non-text type on older DBs.
-- Casting to text is safe when title is already text (no functional change).

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

  SELECT COALESCE(smp.title::text, '') INTO v_plan_title
  FROM public.social_media_plans smp
  WHERE smp.id = NEW.social_media_plan_id;

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
    trim(COALESCE(NEW.commenter_display_name::text, '')),
    NULL::timestamptz,
    now()
  FROM public.public_review_tokens prt
  WHERE prt.social_media_plan_id = NEW.social_media_plan_id
    AND prt.created_by IS NOT NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_notify_review_comment() IS
  'After insert on link_comments: notify users who created a public review token. title::text avoids 42804 when plans.title is not plain text.';
