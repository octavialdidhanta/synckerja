-- Threads livechat inbox: conversations/messages/cycles, RPC, SLA, lead assignee sync.

-- ---------------------------------------------------------------------------
-- 1) threads_verify_token on organization_instagram_accounts (Threads webhook GET)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_instagram_accounts
  ADD COLUMN IF NOT EXISTS threads_verify_token TEXT;

COMMENT ON COLUMN public.organization_instagram_accounts.threads_verify_token IS
  'Per-account Meta Threads webhook verify token (th_{orgSlice}_{random}), used on Threads webhook subscription.';

-- ---------------------------------------------------------------------------
-- 2) threads_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  customer_threads_id TEXT NOT NULL,
  customer_name TEXT,
  customer_external_id TEXT,
  root_media_id TEXT NOT NULL,
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
  CONSTRAINT uq_threads_conv_org_account_customer_root
    UNIQUE (organization_id, threads_user_id, customer_threads_id, root_media_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_conversations_organization_id
  ON public.threads_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_threads_conversations_last_message_at
  ON public.threads_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_threads_conversations_threads_user_id
  ON public.threads_conversations(threads_user_id);
CREATE INDEX IF NOT EXISTS idx_threads_conversations_root_media_id
  ON public.threads_conversations(root_media_id);
CREATE INDEX IF NOT EXISTS idx_threads_conversations_assignee_id
  ON public.threads_conversations(assignee_id);
CREATE INDEX IF NOT EXISTS idx_threads_conversations_last_handling_assignee_id
  ON public.threads_conversations(last_handling_assignee_id)
  WHERE last_handling_assignee_id IS NOT NULL;

COMMENT ON TABLE public.threads_conversations IS
  'Threads livechat conversations. One per (org, threads_user_id, customer, root_media_id).';
COMMENT ON COLUMN public.threads_conversations.meta_session_expires_at IS
  'Meta messaging window expiry (extended on each inbound; mirrors Messenger/Instagram).';

ALTER TABLE public.threads_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org threads conversations" ON public.threads_conversations;
CREATE POLICY "Users can view own org threads conversations"
  ON public.threads_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = threads_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org threads conversations" ON public.threads_conversations;
CREATE POLICY "Users can insert own org threads conversations"
  ON public.threads_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org threads conversations" ON public.threads_conversations;
CREATE POLICY "Users can update own org threads conversations"
  ON public.threads_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = threads_conversations.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_threads_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_threads_conversations_updated_at ON public.threads_conversations;
CREATE TRIGGER trigger_threads_conversations_updated_at
  BEFORE UPDATE ON public.threads_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_threads_conversations_updated_at();

DROP TRIGGER IF EXISTS trg_threads_conversations_snapshot_last_handler ON public.threads_conversations;
CREATE TRIGGER trg_threads_conversations_snapshot_last_handler
  BEFORE UPDATE OF lead_status_id, assignee_id ON public.threads_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_snapshot_last_handler_on_resolve();

-- ---------------------------------------------------------------------------
-- 3) threads_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.threads_conversations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_threads_messages_conversation_id
  ON public.threads_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_threads_messages_created_at
  ON public.threads_messages(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_messages_conv_platform_id
  ON public.threads_messages(conversation_id, platform_message_id)
  WHERE platform_message_id IS NOT NULL AND TRIM(platform_message_id) <> '';

ALTER TABLE public.threads_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org threads messages" ON public.threads_messages;
CREATE POLICY "Users can view own org threads messages"
  ON public.threads_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM threads_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org threads messages" ON public.threads_messages;
CREATE POLICY "Users can insert own org threads messages"
  ON public.threads_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org threads messages" ON public.threads_messages;
CREATE POLICY "Users can update own org threads messages"
  ON public.threads_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM threads_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_messages.conversation_id
    )
  );

COMMENT ON TABLE public.threads_messages IS 'Threads livechat messages (replies and mentions).';

-- ---------------------------------------------------------------------------
-- 4) threads_conversation_cycles (SLA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threads_conversation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.threads_conversations(id) ON DELETE CASCADE,
  cycle_started_at TIMESTAMPTZ NOT NULL,
  first_assignee_in_cycle_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_conversation_cycles_conversation_id
  ON public.threads_conversation_cycles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_threads_conversation_cycles_resolved_at
  ON public.threads_conversation_cycles(resolved_at) WHERE resolved_at IS NOT NULL;

COMMENT ON TABLE public.threads_conversation_cycles IS
  'Mirror facebook_conversation_cycles for Threads livechat.';

ALTER TABLE public.threads_conversation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_conversation_cycles_select" ON public.threads_conversation_cycles;
CREATE POLICY "threads_conversation_cycles_select"
  ON public.threads_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_conversation_cycles_insert" ON public.threads_conversation_cycles;
CREATE POLICY "threads_conversation_cycles_insert"
  ON public.threads_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.threads_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "threads_conversation_cycles_update" ON public.threads_conversation_cycles;
CREATE POLICY "threads_conversation_cycles_update"
  ON public.threads_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = threads_conversation_cycles.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_threads_conversation_cycles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_threads_conversation_cycles_updated_at ON public.threads_conversation_cycles;
CREATE TRIGGER trigger_threads_conversation_cycles_updated_at
  BEFORE UPDATE ON public.threads_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_threads_conversation_cycles_updated_at();

CREATE OR REPLACE FUNCTION public.threads_conversations_set_cycle_first_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.threads_conversation_cycles cy
  SET first_assignee_in_cycle_at = now(), updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_conversations_set_cycle_first_assignee ON public.threads_conversations;
CREATE TRIGGER trg_threads_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.threads_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.threads_conversations_set_cycle_first_assignee();

CREATE OR REPLACE FUNCTION public.threads_conversation_cycles_bi_seed_first_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_assignee uuid;
BEGIN
  SELECT c.assignee_id INTO v_assignee
  FROM public.threads_conversations c
  WHERE c.id = NEW.conversation_id;
  IF v_assignee IS NOT NULL AND NEW.first_assignee_in_cycle_at IS NULL THEN
    NEW.first_assignee_in_cycle_at := NEW.cycle_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_conversation_cycles_bi_seed_first_assignee
  ON public.threads_conversation_cycles;
CREATE TRIGGER trg_threads_conversation_cycles_bi_seed_first_assignee
  BEFORE INSERT ON public.threads_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.threads_conversation_cycles_bi_seed_first_assignee();

GRANT SELECT, INSERT, UPDATE ON public.threads_conversation_cycles TO authenticated;

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threads_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.threads_conversations;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threads_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.threads_messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Ticket id normalization + lead assignee sync (TH-*)
-- ---------------------------------------------------------------------------
UPDATE public.threads_conversations tc
SET
  ticket_id = 'TH-' || UPPER(SUBSTRING(REPLACE(tc.id::text, '-', ''), 1, 8)),
  updated_at = NOW()
WHERE tc.ticket_id IS DISTINCT FROM 'TH-' || UPPER(SUBSTRING(REPLACE(tc.id::text, '-', ''), 1, 8));

UPDATE public.threads_conversations tc
SET
  assignee_id = l.assignee_id,
  updated_at = NOW()
FROM public.leads l
WHERE l.organization_id = tc.organization_id
  AND l.assignee_id IS NOT NULL
  AND tc.assignee_id IS NULL
  AND l.ticket_id IS NOT NULL
  AND TRIM(l.ticket_id) <> ''
  AND (
    UPPER(TRIM(l.ticket_id)) = UPPER(TRIM(tc.ticket_id))
    OR UPPER(TRIM(l.ticket_id)) = 'TH-' || UPPER(SUBSTRING(REPLACE(tc.id::text, '-', ''), 1, 8))
  );

CREATE OR REPLACE FUNCTION public.threads_conversations_normalize_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticket_id := 'TH-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_conversations_normalize_ticket_id ON public.threads_conversations;
CREATE TRIGGER trg_threads_conversations_normalize_ticket_id
  BEFORE INSERT OR UPDATE OF ticket_id ON public.threads_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.threads_conversations_normalize_ticket_id();

CREATE OR REPLACE FUNCTION public.sync_lead_assignee_to_threads_conv()
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
  FROM public.threads_conversations tc
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

  UPDATE public.threads_conversations tc
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

DROP TRIGGER IF EXISTS trg_sync_lead_assignee_to_threads_conv ON public.leads;
CREATE TRIGGER trg_sync_lead_assignee_to_threads_conv
  AFTER UPDATE OF assignee_id, status_id ON public.leads
  FOR EACH ROW
  WHEN (
    NEW.ticket_id IS NOT NULL
    AND TRIM(NEW.ticket_id) <> ''
    AND UPPER(TRIM(NEW.ticket_id)) LIKE 'TH-%'
  )
  EXECUTE FUNCTION public.sync_lead_assignee_to_threads_conv();

COMMENT ON FUNCTION public.sync_lead_assignee_to_threads_conv() IS
  'When assignee/status changes on leads (TH-* ticket), sync to threads_conversations for Live Chat send gate.';

-- ---------------------------------------------------------------------------
-- 6) get_threads_conversations_with_preview
-- ---------------------------------------------------------------------------
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
    c.id,
    c.organization_id,
    c.customer_threads_id,
    c.customer_name,
    c.root_media_id,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.threads_user_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(a.threads_username, '')), ''),
      NULLIF(TRIM(COALESCE(a.instagram_username, '')), ''),
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      c.threads_user_id
    )::TEXT AS threads_account_display_name,
    c.created_at,
    c.updated_at
  FROM public.threads_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN public.organization_instagram_accounts a
    ON a.organization_id = c.organization_id
   AND a.threads_user_id = c.threads_user_id
   AND a.is_active = true
   AND a.has_threads = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.threads_messages
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

COMMENT ON FUNCTION public.get_threads_conversations_with_preview(uuid) IS
  'Threads livechat preview. Owner/Admin all; Employee: assigned, unassigned non-terminal queue, or resolved/expired they closed.';

GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) SLA: normalize channel + ensure_open_threads_conversation_cycle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_sla_channel(ch text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(nullif(trim(ch), ''), 'whatsapp'))
    WHEN 'wa_cloud' THEN 'whatsapp'
    WHEN 'messenger' THEN 'facebook'
    WHEN 'th' THEN 'threads'
    ELSE lower(coalesce(nullif(trim(ch), ''), 'whatsapp'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_threads_conversation_cycle(
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
  v_cycle_started timestamptz;
  v_last_resolved timestamptz;
  v_first_out timestamptz;
BEGIN
  SELECT c.id, c.created_at
  INTO v_conv
  FROM public.threads_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT cy.id
  INTO v_open_cycle_id
  FROM public.threads_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id
    AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at)
    INTO v_first_out
    FROM public.threads_messages m
    INNER JOIN public.threads_conversation_cycles cy ON cy.id = v_open_cycle_id
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= cy.cycle_started_at;

    IF v_first_out IS NOT NULL THEN
      UPDATE public.threads_conversation_cycles
      SET
        first_response_at = coalesce(first_response_at, v_first_out),
        updated_at = now()
      WHERE id = v_open_cycle_id
        AND first_response_at IS NULL;
    END IF;
    RETURN;
  END IF;

  SELECT MAX(cy.resolved_at)
  INTO v_last_resolved
  FROM public.threads_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id;

  SELECT coalesce(
    (
      SELECT MIN(m.created_at)
      FROM public.threads_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
        AND (v_last_resolved IS NULL OR m.created_at > v_last_resolved)
    ),
    (
      SELECT MIN(m.created_at)
      FROM public.threads_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
    ),
    v_conv.created_at,
    now()
  )
  INTO v_cycle_started;

  SELECT MIN(m.created_at)
  INTO v_first_out
  FROM public.threads_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.direction = 'outbound'
    AND m.created_at >= v_cycle_started;

  INSERT INTO public.threads_conversation_cycles (
    conversation_id,
    cycle_started_at,
    first_response_at
  )
  VALUES (
    p_conversation_id,
    v_cycle_started,
    v_first_out
  );
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
    PERFORM public.ensure_open_threads_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'email' THEN
    PERFORM public.ensure_open_email_conversation_cycle(p_organization_id, p_conversation_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid, uuid) TO authenticated, service_role;
