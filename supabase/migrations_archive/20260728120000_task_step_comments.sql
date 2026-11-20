-- Task step comments: threaded discussion, reactions, read cursors, FCM push queue.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_step_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  task_step_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  parent_id uuid NULL REFERENCES public.task_step_comments (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  mentioned_profile_ids uuid[] NOT NULL DEFAULT '{}',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_step_comments_step_created
  ON public.task_step_comments (task_step_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_task_step_comments_parent
  ON public.task_step_comments (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.task_step_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.task_step_comments (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_step_comment_reactions_emoji_check
    CHECK (emoji IN ('like', 'heart', 'laugh', 'celebrate', 'question')),
  CONSTRAINT task_step_comment_reactions_unique_per_user
    UNIQUE (comment_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_task_step_comment_reactions_comment
  ON public.task_step_comment_reactions (comment_id);

CREATE TABLE IF NOT EXISTS public.task_step_comment_read_cursors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  task_step_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_step_comment_read_cursors_unique UNIQUE (profile_id, task_step_id)
);

CREATE INDEX IF NOT EXISTS idx_task_step_comment_read_cursors_step
  ON public.task_step_comment_read_cursors (task_step_id);

CREATE TABLE IF NOT EXISTS public.task_step_comment_push_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'reply', 'mention', 'reaction')),
  comment_id uuid NULL REFERENCES public.task_step_comments (id) ON DELETE CASCADE,
  daily_task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  task_step_id uuid NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  actor_profile_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  body_preview text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tsc_push_queue_unsent_recipient
  ON public.task_step_comment_push_queue (recipient_user_id, created_at DESC)
  WHERE sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.profile_user_id(p_profile_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.id = p_profile_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.profile_display_name(p_profile_id uuid, p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(e.full_name), ''),
    NULLIF(trim(e.email), ''),
    NULLIF(trim(p.email), ''),
    'User'
  )::text
  FROM public.profiles p
  LEFT JOIN public.employees e
    ON e.user_id = p.user_id
    AND e.organization_id = p_organization_id
  WHERE p.id = p_profile_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.task_step_comment_can_access(p_task_step_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_steps ts
    JOIN public.daily_tasks dt ON dt.id = ts.task_id
    WHERE ts.id = p_task_step_id
      AND dt.organization_id IN (SELECT public.user_organization_ids())
  )
$$;

CREATE OR REPLACE FUNCTION public.task_step_comment_can_write(p_task_step_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_org_id uuid;
  v_created_by uuid;
  v_profile_id uuid;
  v_employee_id uuid;
BEGIN
  IF NOT public.task_step_comment_can_access(p_task_step_id) THEN
    RETURN false;
  END IF;

  v_profile_id := public.auth_profile_id();
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ts.task_id, dt.organization_id, dt.created_by
  INTO v_task_id, v_org_id, v_created_by
  FROM public.task_steps ts
  JOIN public.daily_tasks dt ON dt.id = ts.task_id
  WHERE ts.id = p_task_step_id
  LIMIT 1;

  IF v_created_by = auth.uid() THEN
    RETURN true;
  END IF;

  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
    AND e.organization_id = v_org_id
  LIMIT 1;

  IF v_employee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.task_steps_assigned tsa
    WHERE tsa.task_step_id = p_task_step_id
      AND tsa.employee_id = v_employee_id
  ) THEN
    RETURN true;
  END IF;

  IF v_employee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.daily_tasks_assigned dta
    WHERE dta.daily_task_id = v_task_id
      AND dta.employee_id = v_employee_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.task_step_comments c
    WHERE c.task_step_id = p_task_step_id
      AND c.profile_id = v_profile_id
      AND c.is_deleted = false
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_task_step_comment_deeplink(
  p_daily_task_id uuid,
  p_task_step_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '/tools/daily-task?task_id=' || p_daily_task_id::text
    || '&task_step_id=' || p_task_step_id::text
    || '&open_step_comment=1'
$$;

-- Enqueue push rows for comment / reply / mention events.
CREATE OR REPLACE FUNCTION public.enqueue_task_step_comment_push(
  p_comment_id uuid,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.task_step_comments%ROWTYPE;
  v_task_id uuid;
  v_step_title text;
  v_actor_name text;
  v_url text;
  v_body_preview text;
  v_author_user_id uuid;
  r_recipient uuid;
BEGIN
  SELECT * INTO v_comment
  FROM public.task_step_comments c
  WHERE c.id = p_comment_id
  LIMIT 1;

  IF NOT FOUND OR v_comment.is_deleted THEN
    RETURN;
  END IF;

  SELECT ts.task_id, COALESCE(NULLIF(trim(ts.title), ''), 'Task Step')
  INTO v_task_id, v_step_title
  FROM public.task_steps ts
  WHERE ts.id = v_comment.task_step_id
  LIMIT 1;

  v_actor_name := public.profile_display_name(v_comment.profile_id, v_comment.organization_id);
  v_url := public.build_task_step_comment_deeplink(v_task_id, v_comment.task_step_id);
  v_body_preview := left(regexp_replace(COALESCE(v_comment.body, ''), '\s+', ' ', 'g'), 120);
  v_author_user_id := public.profile_user_id(v_comment.profile_id);

  FOR r_recipient IN
    SELECT DISTINCT uid FROM (
      -- Step assignees
      SELECT public.employee_user_id(tsa.employee_id) AS uid
      FROM public.task_steps_assigned tsa
      WHERE tsa.task_step_id = v_comment.task_step_id
        AND public.employee_user_id(tsa.employee_id) IS NOT NULL
      UNION
      -- Step assigners
      SELECT public.employee_user_id(tsa.assigned_by) AS uid
      FROM public.task_steps_assigned tsa
      WHERE tsa.task_step_id = v_comment.task_step_id
        AND public.employee_user_id(tsa.assigned_by) IS NOT NULL
      UNION
      -- Task assignees
      SELECT public.employee_user_id(dta.employee_id) AS uid
      FROM public.daily_tasks_assigned dta
      WHERE dta.daily_task_id = v_task_id
        AND public.employee_user_id(dta.employee_id) IS NOT NULL
      UNION
      -- Task assigners
      SELECT public.employee_user_id(dta.assigned_by) AS uid
      FROM public.daily_tasks_assigned dta
      WHERE dta.daily_task_id = v_task_id
        AND public.employee_user_id(dta.assigned_by) IS NOT NULL
      UNION
      -- Task creator
      SELECT dt.created_by AS uid
      FROM public.daily_tasks dt
      WHERE dt.id = v_task_id
        AND dt.created_by IS NOT NULL
      UNION
      -- Mentioned profiles
      SELECT public.profile_user_id(mp) AS uid
      FROM unnest(COALESCE(v_comment.mentioned_profile_ids, '{}'::uuid[])) AS mp
      WHERE public.profile_user_id(mp) IS NOT NULL
      UNION
      -- Thread participants
      SELECT public.profile_user_id(c.profile_id) AS uid
      FROM public.task_step_comments c
      WHERE c.task_step_id = v_comment.task_step_id
        AND c.is_deleted = false
        AND public.profile_user_id(c.profile_id) IS NOT NULL
    ) recipients
    WHERE uid IS NOT NULL
      AND uid IS DISTINCT FROM v_author_user_id
  LOOP
    INSERT INTO public.task_step_comment_push_queue (
      organization_id,
      recipient_user_id,
      event_type,
      comment_id,
      daily_task_id,
      task_step_id,
      actor_profile_id,
      title,
      body_preview,
      url
    ) VALUES (
      v_comment.organization_id,
      r_recipient,
      p_event_type,
      v_comment.id,
      v_task_id,
      v_comment.task_step_id,
      v_comment.profile_id,
      v_step_title,
      v_body_preview,
      v_url
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_task_step_comment_reaction_push(
  p_comment_id uuid,
  p_actor_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.task_step_comments%ROWTYPE;
  v_task_id uuid;
  v_step_title text;
  v_actor_name text;
  v_url text;
  v_author_user_id uuid;
  r_recipient uuid;
BEGIN
  SELECT * INTO v_comment
  FROM public.task_step_comments c
  WHERE c.id = p_comment_id
  LIMIT 1;

  IF NOT FOUND OR v_comment.is_deleted THEN
    RETURN;
  END IF;

  SELECT ts.task_id, COALESCE(NULLIF(trim(ts.title), ''), 'Task Step')
  INTO v_task_id, v_step_title
  FROM public.task_steps ts
  WHERE ts.id = v_comment.task_step_id
  LIMIT 1;

  v_actor_name := public.profile_display_name(p_actor_profile_id, v_comment.organization_id);
  v_url := public.build_task_step_comment_deeplink(v_task_id, v_comment.task_step_id);
  v_author_user_id := public.profile_user_id(p_actor_profile_id);

  FOR r_recipient IN
    SELECT DISTINCT uid FROM (
      SELECT public.profile_user_id(v_comment.profile_id) AS uid
      UNION
      SELECT public.employee_user_id(tsa.employee_id) AS uid
      FROM public.task_steps_assigned tsa
      WHERE tsa.task_step_id = v_comment.task_step_id
      UNION
      SELECT public.profile_user_id(c.profile_id) AS uid
      FROM public.task_step_comments c
      WHERE c.task_step_id = v_comment.task_step_id
        AND c.is_deleted = false
    ) recipients
    WHERE uid IS NOT NULL
      AND uid IS DISTINCT FROM v_author_user_id
  LOOP
    INSERT INTO public.task_step_comment_push_queue (
      organization_id,
      recipient_user_id,
      event_type,
      comment_id,
      daily_task_id,
      task_step_id,
      actor_profile_id,
      title,
      body_preview,
      url
    ) VALUES (
      v_comment.organization_id,
      r_recipient,
      'reaction',
      v_comment.id,
      v_task_id,
      v_comment.task_step_id,
      p_actor_profile_id,
      v_step_title,
      v_actor_name || ' reacted',
      v_url
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_task_step_comment_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    v_event_type := 'comment';
  ELSE
    v_event_type := 'reply';
  END IF;

  IF COALESCE(array_length(NEW.mentioned_profile_ids, 1), 0) > 0 THEN
    PERFORM public.enqueue_task_step_comment_push(NEW.id, 'mention');
  ELSE
    PERFORM public.enqueue_task_step_comment_push(NEW.id, v_event_type);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_step_comment_notify ON public.task_step_comments;
CREATE TRIGGER trg_task_step_comment_notify
  AFTER INSERT ON public.task_step_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_task_step_comment_notify();

CREATE OR REPLACE FUNCTION public.trg_task_step_comment_reaction_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_task_step_comment_reaction_push(NEW.comment_id, NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_step_comment_reaction_notify ON public.task_step_comment_reactions;
CREATE TRIGGER trg_task_step_comment_reaction_notify
  AFTER INSERT ON public.task_step_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_task_step_comment_reaction_notify();

CREATE OR REPLACE FUNCTION public.trg_task_step_comments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_step_comments_updated_at ON public.task_step_comments;
CREATE TRIGGER trg_task_step_comments_updated_at
  BEFORE UPDATE ON public.task_step_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_task_step_comments_updated_at();

-- ---------------------------------------------------------------------------
-- Claim RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_task_step_comment_push_queue(
  p_recipient_user_id uuid,
  p_window_seconds integer DEFAULT 20,
  p_max integer DEFAULT 25
)
RETURNS SETOF public.task_step_comment_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.task_step_comment_push_queue q
    WHERE q.recipient_user_id = p_recipient_user_id
      AND q.sent_at IS NULL
      AND q.created_at >= now() - make_interval(secs => GREATEST(1, p_window_seconds))
    ORDER BY q.created_at DESC
    LIMIT GREATEST(1, p_max)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.task_step_comment_push_queue q
    SET sent_at = now()
    FROM candidates c
    WHERE q.id = c.id
      AND q.sent_at IS NULL
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;

-- Unread count RPC for badge
CREATE OR REPLACE FUNCTION public.task_step_comment_unread_count(p_task_step_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.task_step_comments c
    WHERE c.task_step_id = p_task_step_id
      AND c.is_deleted = false
      AND c.created_at > COALESCE(
        (
          SELECT rc.last_read_at
          FROM public.task_step_comment_read_cursors rc
          WHERE rc.task_step_id = p_task_step_id
            AND rc.profile_id = public.auth_profile_id()
          LIMIT 1
        ),
        'epoch'::timestamptz
      )
      AND c.profile_id IS DISTINCT FROM public.auth_profile_id()
  ), 0)
$$;

CREATE OR REPLACE FUNCTION public.mark_task_step_comments_read(p_task_step_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_profile_id();
  IF v_profile_id IS NULL OR p_task_step_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.task_step_comment_read_cursors (profile_id, task_step_id, last_read_at)
  VALUES (v_profile_id, p_task_step_id, now())
  ON CONFLICT (profile_id, task_step_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_step_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_step_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_step_comment_read_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_step_comment_push_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_step_comments_select" ON public.task_step_comments;
CREATE POLICY "task_step_comments_select"
  ON public.task_step_comments FOR SELECT TO authenticated
  USING (public.task_step_comment_can_access(task_step_id));

DROP POLICY IF EXISTS "task_step_comments_insert" ON public.task_step_comments;
CREATE POLICY "task_step_comments_insert"
  ON public.task_step_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.task_step_comment_can_write(task_step_id)
    AND profile_id = public.auth_profile_id()
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "task_step_comments_update_own" ON public.task_step_comments;
CREATE POLICY "task_step_comments_update_own"
  ON public.task_step_comments FOR UPDATE TO authenticated
  USING (profile_id = public.auth_profile_id())
  WITH CHECK (profile_id = public.auth_profile_id());

DROP POLICY IF EXISTS "task_step_comment_reactions_select" ON public.task_step_comment_reactions;
CREATE POLICY "task_step_comment_reactions_select"
  ON public.task_step_comment_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.task_step_comments c
      WHERE c.id = comment_id
        AND public.task_step_comment_can_access(c.task_step_id)
    )
  );

DROP POLICY IF EXISTS "task_step_comment_reactions_insert" ON public.task_step_comment_reactions;
CREATE POLICY "task_step_comment_reactions_insert"
  ON public.task_step_comment_reactions FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = public.auth_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.task_step_comments c
      WHERE c.id = comment_id
        AND public.task_step_comment_can_write(c.task_step_id)
    )
  );

DROP POLICY IF EXISTS "task_step_comment_reactions_delete_own" ON public.task_step_comment_reactions;
CREATE POLICY "task_step_comment_reactions_delete_own"
  ON public.task_step_comment_reactions FOR DELETE TO authenticated
  USING (profile_id = public.auth_profile_id());

DROP POLICY IF EXISTS "task_step_comment_reactions_update_own" ON public.task_step_comment_reactions;
CREATE POLICY "task_step_comment_reactions_update_own"
  ON public.task_step_comment_reactions FOR UPDATE TO authenticated
  USING (profile_id = public.auth_profile_id())
  WITH CHECK (profile_id = public.auth_profile_id());

DROP POLICY IF EXISTS "task_step_comment_read_cursors_select_own" ON public.task_step_comment_read_cursors;
CREATE POLICY "task_step_comment_read_cursors_select_own"
  ON public.task_step_comment_read_cursors FOR SELECT TO authenticated
  USING (profile_id = public.auth_profile_id());

DROP POLICY IF EXISTS "task_step_comment_read_cursors_upsert_own" ON public.task_step_comment_read_cursors;
CREATE POLICY "task_step_comment_read_cursors_upsert_own"
  ON public.task_step_comment_read_cursors FOR ALL TO authenticated
  USING (profile_id = public.auth_profile_id())
  WITH CHECK (profile_id = public.auth_profile_id());

DROP POLICY IF EXISTS "task_step_comment_push_queue_select_own" ON public.task_step_comment_push_queue;
CREATE POLICY "task_step_comment_push_queue_select_own"
  ON public.task_step_comment_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

REVOKE ALL ON FUNCTION public.auth_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_profile_id() TO authenticated;
REVOKE ALL ON FUNCTION public.task_step_comment_unread_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_step_comment_unread_count(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_task_step_comments_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_task_step_comments_read(uuid) TO authenticated;
