-- Threads private DM livechat (mirror Instagram DM). Public reply v1 archived on threads_conversations.

-- ---------------------------------------------------------------------------
-- 1) Archive legacy public-reply livechat rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.threads_conversations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.threads_conversations
SET archived_at = COALESCE(archived_at, NOW())
WHERE archived_at IS NULL;

COMMENT ON COLUMN public.threads_conversations.archived_at IS
  'When set, row is legacy public-reply livechat v1 — use manage-comments instead.';

-- ---------------------------------------------------------------------------
-- 2) threads_dm_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  customer_participant_id TEXT NOT NULL,
  customer_name TEXT,
  customer_external_id TEXT,
  customer_username TEXT,
  conversation_origin TEXT NOT NULL DEFAULT 'threads_app',
  instagram_conversation_id UUID REFERENCES public.instagram_conversations(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL,
  first_inbound_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  meta_session_expires_at TIMESTAMPTZ,
  assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  last_handling_assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ticket_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_threads_dm_conv_org_account_customer
    UNIQUE (organization_id, threads_user_id, customer_participant_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_dm_conversations_organization_id
  ON public.threads_dm_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_threads_dm_conversations_last_message_at
  ON public.threads_dm_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_threads_dm_conversations_threads_user_id
  ON public.threads_dm_conversations(threads_user_id);
CREATE INDEX IF NOT EXISTS idx_threads_dm_conversations_assignee_id
  ON public.threads_dm_conversations(assignee_id);

ALTER TABLE public.threads_dm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_dm_conversations_select" ON public.threads_dm_conversations;
CREATE POLICY "threads_dm_conversations_select"
  ON public.threads_dm_conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = threads_dm_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_conversations_insert" ON public.threads_dm_conversations;
CREATE POLICY "threads_dm_conversations_insert"
  ON public.threads_dm_conversations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_conversations_update" ON public.threads_dm_conversations;
CREATE POLICY "threads_dm_conversations_update"
  ON public.threads_dm_conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = threads_dm_conversations.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3) threads_dm_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.threads_dm_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  platform_message_id TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  raw_metadata JSONB,
  status TEXT,
  status_updated_at TIMESTAMPTZ,
  reply_to_platform_message_id TEXT,
  reply_to_body TEXT,
  reply_to_message_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_dm_messages_conv_platform_id
  ON public.threads_dm_messages(conversation_id, platform_message_id)
  WHERE platform_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_threads_dm_messages_conversation_id
  ON public.threads_dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_threads_dm_messages_created_at
  ON public.threads_dm_messages(created_at);

ALTER TABLE public.threads_dm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_dm_messages_select" ON public.threads_dm_messages;
CREATE POLICY "threads_dm_messages_select"
  ON public.threads_dm_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_dm_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_messages_insert" ON public.threads_dm_messages;
CREATE POLICY "threads_dm_messages_insert"
  ON public.threads_dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_messages_update" ON public.threads_dm_messages;
CREATE POLICY "threads_dm_messages_update"
  ON public.threads_dm_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_dm_messages.conversation_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4) threads_dm_conversation_cycles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_dm_conversation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.threads_dm_conversations(id) ON DELETE CASCADE,
  cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_assignee_in_cycle_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_dm_conversation_cycles_conversation_id
  ON public.threads_dm_conversation_cycles(conversation_id);

ALTER TABLE public.threads_dm_conversation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_dm_conversation_cycles_select" ON public.threads_dm_conversation_cycles;
CREATE POLICY "threads_dm_conversation_cycles_select"
  ON public.threads_dm_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_dm_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_conversation_cycles_insert" ON public.threads_dm_conversation_cycles;
CREATE POLICY "threads_dm_conversation_cycles_insert"
  ON public.threads_dm_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_dm_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_dm_conversation_cycles_update" ON public.threads_dm_conversation_cycles;
CREATE POLICY "threads_dm_conversation_cycles_update"
  ON public.threads_dm_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_dm_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_dm_conversation_cycles.conversation_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.threads_dm_conversation_cycles TO authenticated;

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threads_dm_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.threads_dm_conversations;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threads_dm_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.threads_dm_messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Ticket id + lead sync (TH-*)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.threads_dm_conversations_normalize_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticket_id := 'TH-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_dm_conversations_normalize_ticket_id ON public.threads_dm_conversations;
CREATE TRIGGER trg_threads_dm_conversations_normalize_ticket_id
  BEFORE INSERT OR UPDATE OF ticket_id ON public.threads_dm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.threads_dm_conversations_normalize_ticket_id();

CREATE OR REPLACE FUNCTION public.sync_lead_assignee_to_threads_dm_conv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket text;
  v_conv_id uuid;
BEGIN
  v_ticket := UPPER(TRIM(COALESCE(NEW.ticket_id, '')));
  IF v_ticket = '' OR NEW.organization_id IS NULL OR v_ticket NOT LIKE 'TH-%' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id
    AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT tc.id INTO v_conv_id
  FROM public.threads_dm_conversations tc
  WHERE tc.organization_id = NEW.organization_id
    AND (
      UPPER(TRIM(COALESCE(tc.ticket_id, ''))) = v_ticket
      OR ('TH-' || UPPER(SUBSTRING(REPLACE(tc.id::text, '-', ''), 1, 8))) = v_ticket
    )
  ORDER BY tc.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.threads_dm_conversations tc
  SET
    assignee_id = NEW.assignee_id,
    lead_status_id = COALESCE(NEW.status_id, tc.lead_status_id),
    updated_at = NOW()
  WHERE tc.id = v_conv_id
    AND (
      tc.assignee_id IS DISTINCT FROM NEW.assignee_id
      OR tc.lead_status_id IS DISTINCT FROM NEW.status_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_assignee_to_threads_dm_conv ON public.leads;
CREATE TRIGGER trg_sync_lead_assignee_to_threads_dm_conv
  AFTER UPDATE OF assignee_id, status_id ON public.leads
  FOR EACH ROW
  WHEN (
    NEW.ticket_id IS NOT NULL
    AND TRIM(NEW.ticket_id) <> ''
    AND UPPER(TRIM(NEW.ticket_id)) LIKE 'TH-%'
  )
  EXECUTE FUNCTION public.sync_lead_assignee_to_threads_dm_conv();

CREATE OR REPLACE FUNCTION public.threads_dm_conversations_set_cycle_first_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN RETURN NEW; END IF;
  UPDATE public.threads_dm_conversation_cycles cy
  SET first_assignee_in_cycle_at = now(), updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_dm_conversations_set_cycle_first_assignee ON public.threads_dm_conversations;
CREATE TRIGGER trg_threads_dm_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.threads_dm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.threads_dm_conversations_set_cycle_first_assignee();

-- ---------------------------------------------------------------------------
-- 6) get_threads_dm_conversations_with_preview (livechat list)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_threads_dm_conversations_with_preview(uuid);

CREATE FUNCTION public.get_threads_dm_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_participant_id text,
  customer_threads_id text,
  customer_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  threads_user_id text,
  threads_account_display_name text,
  ticket_id text,
  assignee_id uuid,
  meta_session_expires_at timestamptz,
  last_inbound_at timestamptz,
  conversation_origin text,
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
    c.customer_participant_id,
    c.customer_participant_id AS customer_threads_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.threads_user_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(acct.threads_username, '')), ''),
      NULLIF(TRIM(COALESCE(acct.instagram_username, '')), ''),
      NULLIF(TRIM(COALESCE(acct.instagram_name, '')), ''),
      c.threads_user_id
    )::TEXT AS threads_account_display_name,
    c.ticket_id,
    c.assignee_id,
    c.meta_session_expires_at,
    c.last_inbound_at,
    c.conversation_origin,
    c.created_at,
    c.updated_at
  FROM public.threads_dm_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN LATERAL (
    SELECT a.threads_username, a.instagram_username, a.instagram_name
    FROM public.organization_instagram_accounts a
    WHERE a.organization_id = c.organization_id
      AND a.threads_user_id = c.threads_user_id
      AND a.is_active = true
      AND a.has_threads = true
    ORDER BY a.updated_at DESC NULLS LAST
    LIMIT 1
  ) acct ON true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.threads_dm_messages
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

COMMENT ON FUNCTION public.get_threads_dm_conversations_with_preview(uuid) IS
  'Threads private DM livechat preview. Owner/Admin all; Employee: assigned or queue.';

GRANT EXECUTE ON FUNCTION public.get_threads_dm_conversations_with_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_threads_dm_conversations_with_preview(uuid) TO service_role;

-- Legacy RPC: exclude archived public-reply rows
DROP FUNCTION IF EXISTS public.get_threads_conversations_with_preview(uuid);

CREATE FUNCTION public.get_threads_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_threads_id text,
  customer_name text,
  root_media_id text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  threads_user_id text,
  threads_account_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.organization_id, c.customer_threads_id, c.customer_name, c.root_media_id,
    c.last_message_at, c.last_message_body, c.last_message_direction, c.last_message_status,
    c.lead_status_id, ls.name, c.threads_user_id, c.threads_user_id, c.created_at, c.updated_at
  FROM public.threads_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  WHERE c.organization_id = p_organization_id
    AND c.archived_at IS NOT NULL
    AND false;
$$;

GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) SLA cycle helper for threads DM
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_open_threads_dm_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_open_cycle_id uuid;
  v_first_out timestamptz;
BEGIN
  SELECT c.id, c.created_at
  INTO v_conv
  FROM public.threads_dm_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT cy.id INTO v_open_cycle_id
  FROM public.threads_dm_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at) INTO v_first_out
    FROM public.threads_dm_messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= (
        SELECT cycle_started_at FROM public.threads_dm_conversation_cycles WHERE id = v_open_cycle_id
      );
    IF v_first_out IS NOT NULL THEN
      UPDATE public.threads_dm_conversation_cycles
      SET first_response_at = COALESCE(first_response_at, v_first_out), updated_at = now()
      WHERE id = v_open_cycle_id AND first_response_at IS NULL;
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.threads_dm_conversation_cycles (conversation_id, cycle_started_at)
  VALUES (p_conversation_id, COALESCE(v_conv.created_at, now()));
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_omnichannel_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch text := public.normalize_sla_channel(p_channel);
BEGIN
  IF v_ch = 'whatsapp' THEN
    PERFORM public.ensure_open_whatsapp_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'instagram' THEN
    PERFORM public.ensure_open_instagram_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'facebook' THEN
    PERFORM public.ensure_open_facebook_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'threads' THEN
    PERFORM public.ensure_open_threads_dm_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'email' THEN
    PERFORM public.ensure_open_email_conversation_cycle(p_organization_id, p_conversation_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_open_threads_dm_conversation_cycle(uuid, uuid) TO authenticated, service_role;
