-- Hybrid assignee policy after resolve (Option A + post-resolve visibility):
--   assignee_id              = active operational owner (In Progress, send, idle metrics)
--   last_handling_assignee_id = closing agent for resolved/expired room visibility + survey context

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_handling_assignee_id uuid
    REFERENCES public.employees (id) ON DELETE SET NULL;

ALTER TABLE public.instagram_conversations
  ADD COLUMN IF NOT EXISTS last_handling_assignee_id uuid
    REFERENCES public.employees (id) ON DELETE SET NULL;

ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS last_handling_assignee_id uuid
    REFERENCES public.employees (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.whatsapp_conversations.assignee_id IS
  'Active operational assignee (In Progress). Cleared on resolve; used for send guard and idle metrics.';

COMMENT ON COLUMN public.whatsapp_conversations.last_handling_assignee_id IS
  'Employee who closed the current resolve/expired cycle. Used for post-resolve livechat visibility (non-owner) and survey attribution context; not used for idle/active counts.';

COMMENT ON COLUMN public.instagram_conversations.assignee_id IS
  'Active operational assignee (In Progress). Cleared on resolve; used for send guard and idle metrics.';

COMMENT ON COLUMN public.instagram_conversations.last_handling_assignee_id IS
  'Employee who closed the current resolve/expired cycle. Post-resolve livechat visibility for non-owner agents.';

COMMENT ON COLUMN public.email_conversations.assignee_id IS
  'Active operational assignee (In Progress). Cleared on resolve; synced from leads in app.';

COMMENT ON COLUMN public.email_conversations.last_handling_assignee_id IS
  'Employee who closed the current resolve/expired cycle. Post-resolve livechat visibility for non-owner agents.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_handling_assignee_id
  ON public.whatsapp_conversations (last_handling_assignee_id)
  WHERE last_handling_assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_last_handling_assignee_id
  ON public.instagram_conversations (last_handling_assignee_id)
  WHERE last_handling_assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_conversations_last_handling_assignee_id
  ON public.email_conversations (last_handling_assignee_id)
  WHERE last_handling_assignee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Status helpers (visibility: resolved + expired)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_status_is_resolved_or_expired_visibility(p_lead_status_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses ls
    WHERE ls.id = p_lead_status_id
      AND lower(trim(ls.name)) = ANY (ARRAY['closed'::text, 'resolve'::text, 'expired'::text])
  );
$$;

COMMENT ON FUNCTION public.lead_status_is_resolved_or_expired_visibility(uuid) IS
  'True when status is Resolve/Closed/Expired — used for post-resolve livechat list visibility via last_handling_assignee_id.';

-- Snapshot closing agent when conversation newly enters resolved/expired (before assignee_id is cleared in same UPDATE).
CREATE OR REPLACE FUNCTION public.conversations_snapshot_last_handler_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_status_id IS NOT DISTINCT FROM OLD.lead_status_id THEN
    RETURN NEW;
  END IF;

  IF public.lead_status_is_resolved_or_expired_visibility(NEW.lead_status_id)
     AND NOT public.lead_status_is_resolved_or_expired_visibility(OLD.lead_status_id) THEN
    NEW.last_handling_assignee_id := COALESCE(OLD.assignee_id, NEW.last_handling_assignee_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_snapshot_last_handler ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_snapshot_last_handler
  BEFORE UPDATE OF lead_status_id, assignee_id ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_snapshot_last_handler_on_resolve();

DROP TRIGGER IF EXISTS trg_instagram_conversations_snapshot_last_handler ON public.instagram_conversations;
CREATE TRIGGER trg_instagram_conversations_snapshot_last_handler
  BEFORE UPDATE OF lead_status_id, assignee_id ON public.instagram_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_snapshot_last_handler_on_resolve();

DROP TRIGGER IF EXISTS trg_email_conversations_snapshot_last_handler ON public.email_conversations;
CREATE TRIGGER trg_email_conversations_snapshot_last_handler
  BEFORE UPDATE OF lead_status_id, assignee_id ON public.email_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_snapshot_last_handler_on_resolve();

-- ---------------------------------------------------------------------------
-- Employee visibility helper (non-owner/admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omnichannel_employee_sees_conversation(
  p_assignee_id uuid,
  p_last_handling_assignee_id uuid,
  p_lead_status_id uuid,
  p_employee_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_employee_id IS NOT NULL
    AND (
      p_assignee_id = p_employee_id
      OR (
        p_assignee_id IS NULL
        AND p_last_handling_assignee_id = p_employee_id
        AND public.lead_status_is_resolved_or_expired_visibility(p_lead_status_id)
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- get_whatsapp_conversations_with_preview
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(uuid);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_wa_id text,
  customer_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  channel text,
  phone_number_id text,
  whatsapp_account_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    COALESCE(
      NULLIF(TRIM(a.whatsapp_business_name), ''),
      NULLIF(TRIM(a.display_phone_number), ''),
      a.phone_number_id
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM public.whatsapp_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN public.organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
    AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
    AND (
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
        LIMIT 1
      ) IN ('owner', 'admin')
      OR public.omnichannel_employee_sees_conversation(
        c.assignee_id,
        c.last_handling_assignee_id,
        c.lead_status_id,
        (
          SELECT e.id
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = p_organization_id
          LIMIT 1
        )
      )
    )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_whatsapp_conversations_with_preview(uuid) IS
  'WhatsApp conversations with preview. Owner/Admin see all; Employee sees active assignee OR resolved/expired they closed (last_handling_assignee_id).';

-- ---------------------------------------------------------------------------
-- get_instagram_conversations_with_preview (keep unassigned non-terminal for all agents)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_instagram_conversations_with_preview(uuid);

CREATE FUNCTION public.get_instagram_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_ig_id text,
  customer_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  instagram_business_account_id text,
  instagram_account_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_ig_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.instagram_business_account_id,
    COALESCE(
      CASE
        WHEN a.instagram_username IS NOT NULL AND TRIM(a.instagram_username) <> '' THEN '@' || TRIM(a.instagram_username)
      END,
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      a.instagram_business_account_id
    )::TEXT AS instagram_account_display_name,
    c.created_at,
    c.updated_at
  FROM public.instagram_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN public.organization_instagram_accounts a
    ON a.organization_id = c.organization_id
   AND a.instagram_business_account_id = c.instagram_business_account_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.instagram_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
    AND (
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
        LIMIT 1
      ) IN ('owner', 'admin')
      OR (
        (
          SELECT e.id
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = p_organization_id
          LIMIT 1
        ) IS NOT NULL
        AND (
          c.assignee_id = (
            SELECT e.id
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.organization_id = p_organization_id
            LIMIT 1
          )
          OR (
            c.assignee_id IS NULL
            AND NOT public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id)
          )
          OR public.omnichannel_employee_sees_conversation(
            c.assignee_id,
            c.last_handling_assignee_id,
            c.lead_status_id,
            (
              SELECT e.id
              FROM public.employees e
              WHERE e.user_id = auth.uid()
                AND e.organization_id = p_organization_id
              LIMIT 1
            )
          )
        )
      )
    )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(uuid) IS
  'Instagram DM preview. Owner/Admin all; Employee: assigned, unassigned non-terminal queue, or resolved/expired they closed.';

-- ---------------------------------------------------------------------------
-- get_email_conversations_with_preview
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_email_conversations_with_preview(uuid);

CREATE FUNCTION public.get_email_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email_connection_id uuid,
  from_email text,
  from_display_name text,
  thread_subject text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  email_connection_display text,
  created_at timestamptz,
  updated_at timestamptz,
  lead_status_id uuid,
  followup integer,
  fu_priority text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    c.from_display_name,
    c.thread_subject,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at,
    c.lead_status_id,
    COALESCE(c.followup, 0),
    c.fu_priority
  FROM public.email_conversations c
  JOIN public.organization_email_connections conn
    ON conn.id = c.email_connection_id
   AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM public.email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
    AND (
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
        LIMIT 1
      ) IN ('owner', 'admin')
      OR public.omnichannel_employee_sees_conversation(
        c.assignee_id,
        c.last_handling_assignee_id,
        c.lead_status_id,
        (
          SELECT e.id
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = p_organization_id
          LIMIT 1
        )
      )
    )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_email_conversations_with_preview(uuid) IS
  'Email preview. Owner/Admin all; Employee: active assignee OR resolved/expired they closed (conversation assignee columns).';

-- Backfill last handler for already-resolved rows that still have no snapshot (best-effort from current assignee before clear is lost).
UPDATE public.whatsapp_conversations c
SET last_handling_assignee_id = c.assignee_id
WHERE c.assignee_id IS NOT NULL
  AND c.last_handling_assignee_id IS NULL
  AND public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id);

UPDATE public.instagram_conversations c
SET last_handling_assignee_id = c.assignee_id
WHERE c.assignee_id IS NOT NULL
  AND c.last_handling_assignee_id IS NULL
  AND public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id);

UPDATE public.email_conversations c
SET last_handling_assignee_id = c.assignee_id
WHERE c.assignee_id IS NOT NULL
  AND c.last_handling_assignee_id IS NULL
  AND public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id);

-- Note: enqueue_customer_survey_on_wa_resolve uses COALESCE(NEW.assignee_id, OLD.assignee_id) for survey rows,
-- not last_handling_assignee_id. Idle Agents (app) counts only live assignee_id on In Progress leads.
