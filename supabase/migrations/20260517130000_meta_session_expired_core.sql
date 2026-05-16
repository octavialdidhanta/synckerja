-- Meta-driven session expiry: store Meta expiration_timestamp on conversations; master status "Expired";
-- periodic job sets Expired when meta_session_expires_at < now(); disable 24h auto-close for WA/IG (email unchanged).

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS meta_session_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.whatsapp_conversations.meta_session_expires_at IS
  'Customer messaging session expiry from Meta (e.g. statuses[].conversation.expiration_timestamp). Not a server-side 24h calculation.';

ALTER TABLE public.instagram_conversations
  ADD COLUMN IF NOT EXISTS meta_session_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.instagram_conversations.meta_session_expires_at IS
  'DM session expiry from Meta when available (webhook or send response).';

-- Global master status for Meta session ended (org_id NULL so all orgs can FK).
INSERT INTO public.lead_statuses (id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'Expired',
  'Messaging session ended per Meta WhatsApp / Instagram Cloud API (not manual resolve).',
  '#78716C',
  TRUE,
  6,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_statuses ls
  WHERE ls.organization_id IS NULL AND lower(btrim(ls.name)) = 'expired'
);

-- Apply Expired when Meta timestamp has passed; skip manual terminal statuses.
CREATE OR REPLACE FUNCTION public.apply_meta_session_expired_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT := 0;
  r RECORD;
  v_expired_id UUID;
  v_old_name TEXT;
BEGIN
  FOR r IN
    SELECT w.id, w.organization_id, w.lead_status_id, ls.name AS status_name
    FROM public.whatsapp_conversations w
    LEFT JOIN public.lead_statuses ls ON ls.id = w.lead_status_id
    WHERE w.meta_session_expires_at IS NOT NULL
      AND w.meta_session_expires_at < NOW()
  LOOP
    IF lower(btrim(COALESCE(r.status_name, ''))) IN ('closed', 'lost', 'converted', 'expired') THEN
      CONTINUE;
    END IF;

    SELECT ls2.id
    INTO v_expired_id
    FROM public.lead_statuses ls2
    WHERE lower(btrim(ls2.name)) = 'expired'
      AND (ls2.organization_id = r.organization_id OR ls2.organization_id IS NULL)
    ORDER BY CASE WHEN ls2.organization_id IS NOT DISTINCT FROM r.organization_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_expired_id IS NULL THEN
      CONTINUE;
    END IF;

    v_old_name := r.status_name;

    UPDATE public.whatsapp_conversations
    SET lead_status_id = v_expired_id, updated_at = NOW()
    WHERE id = r.id;

    INSERT INTO public.whatsapp_conversation_status_history (
      conversation_id, old_status, new_status, changed_at, changed_by, changed_by_name, organization_id
    ) VALUES (
      r.id, v_old_name, 'Expired', NOW(), NULL, 'Meta', r.organization_id
    );

    n := n + 1;
  END LOOP;

  -- Instagram native conversations (same Meta-driven rule; no WA-style history table).
  FOR r IN
    SELECT i.id, i.organization_id, i.lead_status_id, ls.name AS status_name
    FROM public.instagram_conversations i
    LEFT JOIN public.lead_statuses ls ON ls.id = i.lead_status_id
    WHERE i.meta_session_expires_at IS NOT NULL
      AND i.meta_session_expires_at < NOW()
  LOOP
    IF lower(btrim(COALESCE(r.status_name, ''))) IN ('closed', 'lost', 'converted', 'expired') THEN
      CONTINUE;
    END IF;

    SELECT ls2.id
    INTO v_expired_id
    FROM public.lead_statuses ls2
    WHERE lower(btrim(ls2.name)) = 'expired'
      AND (ls2.organization_id = r.organization_id OR ls2.organization_id IS NULL)
    ORDER BY CASE WHEN ls2.organization_id IS NOT DISTINCT FROM r.organization_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_expired_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.instagram_conversations
    SET lead_status_id = v_expired_id, updated_at = NOW()
    WHERE id = r.id;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.apply_meta_session_expired_conversations() IS
  'Sets lead_status_id to Expired when meta_session_expires_at < now() from Meta; skips Closed/Lost/Converted/Expired. Inserts WA conversation status history. Schedule via pg_cron.';

-- Stop auto-closing WA/IG to Closed after 24h; keep email auto-close behavior.
CREATE OR REPLACE FUNCTION public.auto_resolve_conversations_after_24h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_email INTEGER := 0;
BEGIN
  WITH target AS (
    SELECT e.id, e.organization_id
    FROM public.email_conversations e
    LEFT JOIN public.lead_statuses ls ON ls.id = e.lead_status_id AND ls.organization_id = e.organization_id
    WHERE (COALESCE(e.last_inbound_at, e.created_at)) < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR e.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN public.lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE public.email_conversations e
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE e.id = c.id
    RETURNING e.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_email FROM updated;

  RETURN updated_email;
END;
$$;

COMMENT ON FUNCTION public.auto_resolve_conversations_after_24h() IS
  'Email only: sets email_conversations to Closed after 24h inactivity. WA/IG use Meta meta_session_expires_at + apply_meta_session_expired_conversations() instead.';

-- Schedule Meta expiry flusher every 3 minutes (if pg_cron available).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('apply-meta-session-expired');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'apply-meta-session-expired',
      '*/3 * * * *',
      'SELECT public.apply_meta_session_expired_conversations()'
    );
  END IF;
END $$;
