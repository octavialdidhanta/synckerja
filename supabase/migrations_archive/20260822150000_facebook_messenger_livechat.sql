-- Facebook Messenger livechat: verify_token on pages, conversations/messages/cycles, RPC, SLA.

-- ---------------------------------------------------------------------------
-- 1) verify_token on organization_facebook_pages (webhook GET verify)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_facebook_pages
  ADD COLUMN IF NOT EXISTS verify_token TEXT;

COMMENT ON COLUMN public.organization_facebook_pages.verify_token IS
  'Per-page Meta webhook verify token (fb_{orgSlice}_{random}), generated on OAuth connect.';

-- ---------------------------------------------------------------------------
-- 2) facebook_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facebook_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facebook_page_id TEXT NOT NULL,
  customer_psid TEXT NOT NULL,
  customer_name TEXT,
  customer_external_id TEXT,
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
  CONSTRAINT uq_facebook_conv_org_page_psid UNIQUE (organization_id, facebook_page_id, customer_psid)
);

CREATE INDEX IF NOT EXISTS idx_facebook_conversations_organization_id
  ON public.facebook_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_facebook_conversations_last_message_at
  ON public.facebook_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_facebook_conversations_facebook_page_id
  ON public.facebook_conversations(facebook_page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_conversations_assignee_id
  ON public.facebook_conversations(assignee_id);
CREATE INDEX IF NOT EXISTS idx_facebook_conversations_last_handling_assignee_id
  ON public.facebook_conversations(last_handling_assignee_id)
  WHERE last_handling_assignee_id IS NOT NULL;

COMMENT ON TABLE public.facebook_conversations IS
  'Facebook Messenger conversations. One per (org, facebook_page_id, customer_psid).';
COMMENT ON COLUMN public.facebook_conversations.meta_session_expires_at IS
  'Meta 24h messaging window expiry (extended on each inbound).';

ALTER TABLE public.facebook_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org facebook conversations" ON public.facebook_conversations;
CREATE POLICY "Users can view own org facebook conversations"
  ON public.facebook_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = facebook_conversations.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org facebook conversations" ON public.facebook_conversations;
CREATE POLICY "Users can insert own org facebook conversations"
  ON public.facebook_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org facebook conversations" ON public.facebook_conversations;
CREATE POLICY "Users can update own org facebook conversations"
  ON public.facebook_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = facebook_conversations.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_facebook_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_facebook_conversations_updated_at ON public.facebook_conversations;
CREATE TRIGGER trigger_facebook_conversations_updated_at
  BEFORE UPDATE ON public.facebook_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_facebook_conversations_updated_at();

DROP TRIGGER IF EXISTS trg_facebook_conversations_snapshot_last_handler ON public.facebook_conversations;
CREATE TRIGGER trg_facebook_conversations_snapshot_last_handler
  BEFORE UPDATE OF lead_status_id, assignee_id ON public.facebook_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_snapshot_last_handler_on_resolve();

-- ---------------------------------------------------------------------------
-- 3) facebook_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facebook_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.facebook_conversations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_facebook_messages_conversation_id
  ON public.facebook_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_facebook_messages_created_at
  ON public.facebook_messages(created_at);

ALTER TABLE public.facebook_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org facebook messages" ON public.facebook_messages;
CREATE POLICY "Users can view own org facebook messages"
  ON public.facebook_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM facebook_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org facebook messages" ON public.facebook_messages;
CREATE POLICY "Users can insert own org facebook messages"
  ON public.facebook_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM facebook_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = conversation_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org facebook messages" ON public.facebook_messages;
CREATE POLICY "Users can update own org facebook messages"
  ON public.facebook_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM facebook_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_messages.conversation_id
    )
  );

COMMENT ON TABLE public.facebook_messages IS 'Facebook Messenger messages.';

-- ---------------------------------------------------------------------------
-- 4) facebook_conversation_cycles (SLA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facebook_conversation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.facebook_conversations(id) ON DELETE CASCADE,
  cycle_started_at TIMESTAMPTZ NOT NULL,
  first_assignee_in_cycle_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facebook_conversation_cycles_conversation_id
  ON public.facebook_conversation_cycles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_facebook_conversation_cycles_resolved_at
  ON public.facebook_conversation_cycles(resolved_at) WHERE resolved_at IS NOT NULL;

COMMENT ON TABLE public.facebook_conversation_cycles IS
  'Mirror instagram_conversation_cycles for Facebook Messenger.';

ALTER TABLE public.facebook_conversation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facebook_conversation_cycles_select" ON public.facebook_conversation_cycles;
CREATE POLICY "facebook_conversation_cycles_select"
  ON public.facebook_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facebook_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "facebook_conversation_cycles_insert" ON public.facebook_conversation_cycles;
CREATE POLICY "facebook_conversation_cycles_insert"
  ON public.facebook_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facebook_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "facebook_conversation_cycles_update" ON public.facebook_conversation_cycles;
CREATE POLICY "facebook_conversation_cycles_update"
  ON public.facebook_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facebook_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_conversation_cycles.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_facebook_conversation_cycles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_facebook_conversation_cycles_updated_at ON public.facebook_conversation_cycles;
CREATE TRIGGER trigger_facebook_conversation_cycles_updated_at
  BEFORE UPDATE ON public.facebook_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_facebook_conversation_cycles_updated_at();

CREATE OR REPLACE FUNCTION public.facebook_conversations_set_cycle_first_assignee()
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
  UPDATE public.facebook_conversation_cycles cy
  SET first_assignee_in_cycle_at = now(), updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facebook_conversations_set_cycle_first_assignee ON public.facebook_conversations;
CREATE TRIGGER trg_facebook_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.facebook_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.facebook_conversations_set_cycle_first_assignee();

CREATE OR REPLACE FUNCTION public.facebook_conversation_cycles_bi_seed_first_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_assignee uuid;
BEGIN
  SELECT c.assignee_id INTO v_assignee
  FROM public.facebook_conversations c
  WHERE c.id = NEW.conversation_id;
  IF v_assignee IS NOT NULL AND NEW.first_assignee_in_cycle_at IS NULL THEN
    NEW.first_assignee_in_cycle_at := NEW.cycle_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facebook_conversation_cycles_bi_seed_first_assignee
  ON public.facebook_conversation_cycles;
CREATE TRIGGER trg_facebook_conversation_cycles_bi_seed_first_assignee
  BEFORE INSERT ON public.facebook_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.facebook_conversation_cycles_bi_seed_first_assignee();

GRANT SELECT, INSERT, UPDATE ON public.facebook_conversation_cycles TO authenticated;

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'facebook_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_conversations;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'facebook_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) get_facebook_conversations_with_preview
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_facebook_conversations_with_preview(uuid);

CREATE FUNCTION public.get_facebook_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_psid text,
  customer_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  facebook_page_id text,
  facebook_page_display_name text,
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
    c.customer_psid,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.facebook_page_id,
    COALESCE(NULLIF(TRIM(COALESCE(p.page_name, '')), ''), p.facebook_page_id)::TEXT AS facebook_page_display_name,
    c.created_at,
    c.updated_at
  FROM public.facebook_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN public.organization_facebook_pages p
    ON p.organization_id = c.organization_id
   AND p.facebook_page_id = c.facebook_page_id
   AND p.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.facebook_messages
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

COMMENT ON FUNCTION public.get_facebook_conversations_with_preview(uuid) IS
  'Facebook Messenger preview. Owner/Admin all; Employee: assigned, unassigned non-terminal queue, or resolved/expired they closed.';

GRANT EXECUTE ON FUNCTION public.get_facebook_conversations_with_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_facebook_conversations_with_preview(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) SLA: normalize channel + ensure_open_facebook_conversation_cycle
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
    ELSE lower(coalesce(nullif(trim(ch), ''), 'whatsapp'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_facebook_conversation_cycle(
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
  FROM public.facebook_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT cy.id
  INTO v_open_cycle_id
  FROM public.facebook_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id
    AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at)
    INTO v_first_out
    FROM public.facebook_messages m
    INNER JOIN public.facebook_conversation_cycles cy ON cy.id = v_open_cycle_id
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= cy.cycle_started_at;

    IF v_first_out IS NOT NULL THEN
      UPDATE public.facebook_conversation_cycles
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
  FROM public.facebook_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id;

  SELECT coalesce(
    (
      SELECT MIN(m.created_at)
      FROM public.facebook_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
        AND (v_last_resolved IS NULL OR m.created_at > v_last_resolved)
    ),
    (
      SELECT MIN(m.created_at)
      FROM public.facebook_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
    ),
    v_conv.created_at,
    now()
  )
  INTO v_cycle_started;

  SELECT MIN(m.created_at)
  INTO v_first_out
  FROM public.facebook_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.direction = 'outbound'
    AND m.created_at >= v_cycle_started;

  INSERT INTO public.facebook_conversation_cycles (
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
  ELSIF v_ch = 'email' THEN
    PERFORM public.ensure_open_email_conversation_cycle(p_organization_id, p_conversation_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid, uuid) TO authenticated, service_role;
