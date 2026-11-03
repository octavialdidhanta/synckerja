-- MCP inbox reads: Instagram DM, Facebook Messenger, and WhatsApp conversations
-- stored by instagram-webhook, Messenger livechat, and whatsapp-webhook.
-- Read only. Called by the MCP service with the service role.
--
-- p_employee_id NULL means the caller may see every conversation in the
-- organization (owner or admin, checked by the MCP service). A non-null
-- p_employee_id limits rows to conversations assigned to that employee.
-- Period bounds are calendar days in Asia/Jakarta, end inclusive.
-- Customer ids, phone numbers, and media URLs are never returned.

CREATE OR REPLACE FUNCTION public.mcp_inbox_assert_member(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- One row per conversation across the three channels, with its latest message.
CREATE OR REPLACE FUNCTION public.mcp_inbox_conversation_base(
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text
)
RETURNS TABLE (
  conversation_id uuid,
  channel text,
  customer_name text,
  ticket_id text,
  lead_status_id uuid,
  assignee_id uuid,
  from_ad boolean,
  first_inbound_at timestamptz,
  last_direction text,
  last_body text,
  last_type text,
  last_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, 'instagram'::text, c.customer_name, c.ticket_id, c.lead_status_id, c.assignee_id,
         false, c.first_inbound_at, lm.direction, lm.body, lm.message_type, lm.created_at
  FROM public.instagram_conversations c
  LEFT JOIN LATERAL (
    SELECT m.direction, m.body, m.message_type, m.created_at
    FROM public.instagram_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) lm ON true
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'instagram')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)

  UNION ALL

  SELECT c.id, 'facebook'::text, c.customer_name, c.ticket_id, c.lead_status_id, c.assignee_id,
         false, c.first_inbound_at, lm.direction, lm.body, lm.message_type, lm.created_at
  FROM public.facebook_conversations c
  LEFT JOIN LATERAL (
    SELECT m.direction, m.body, m.message_type, m.created_at
    FROM public.facebook_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) lm ON true
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'facebook')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)

  UNION ALL

  SELECT c.id, 'whatsapp'::text, c.customer_name, c.ticket_id, c.lead_status_id, c.assignee_id,
         (c.ctwa_clid IS NOT NULL OR c.ctwa_referral IS NOT NULL), c.first_inbound_at,
         lm.direction, lm.body, lm.message_type, lm.created_at
  FROM public.whatsapp_conversations c
  LEFT JOIN LATERAL (
    SELECT m.direction, m.body, m.message_type, m.created_at
    FROM public.whatsapp_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) lm ON true
  WHERE c.organization_id = p_organization_id
    AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
    AND (p_channel IS NULL OR p_channel = 'whatsapp')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id);
$$;

-- Messages of the organization's conversations inside [p_from, p_to).
-- is_human_reply is false for WhatsApp automation and system messages.
CREATE OR REPLACE FUNCTION public.mcp_inbox_period_messages(
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  conversation_id uuid,
  channel text,
  message_id uuid,
  direction text,
  is_human_reply boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.conversation_id, 'instagram'::text, m.id, m.direction, m.direction = 'outbound', m.created_at
  FROM public.instagram_messages m
  JOIN public.instagram_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'instagram')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to

  UNION ALL

  SELECT m.conversation_id, 'facebook'::text, m.id, m.direction, m.direction = 'outbound', m.created_at
  FROM public.facebook_messages m
  JOIN public.facebook_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'facebook')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to

  UNION ALL

  SELECT m.conversation_id, 'whatsapp'::text, m.id, m.direction,
         m.direction = 'outbound' AND COALESCE(m.source, 'agent') = 'agent', m.created_at
  FROM public.whatsapp_messages m
  JOIN public.whatsapp_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
    AND (p_channel IS NULL OR p_channel = 'whatsapp')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to;
$$;

CREATE OR REPLACE FUNCTION public.mcp_inbox_bounds(p_start date, p_end date)
RETURNS TABLE (v_from timestamptz, v_to timestamptz)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start > p_end OR p_end - p_start > 92 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_from := p_start::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_to := (p_end + 1)::timestamp AT TIME ZONE 'Asia/Jakarta';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_inbox_check_channel(p_channel text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := NULLIF(lower(btrim(COALESCE(p_channel, ''))), '');
BEGIN
  IF v IS NOT NULL AND v NOT IN ('instagram', 'facebook', 'whatsapp') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_inbox_conversations(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_start date,
  p_end date,
  p_awaiting_only boolean,
  p_limit integer
)
RETURNS TABLE (
  conversation_id uuid,
  channel text,
  customer_name text,
  ticket_id text,
  lead_status text,
  assignee text,
  from_ad boolean,
  first_inbound_at timestamptz,
  last_message_at timestamptz,
  last_message_direction text,
  last_message_preview text,
  awaiting_reply boolean,
  waiting_minutes integer,
  inbound_in_period integer,
  outbound_in_period integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text;
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
BEGIN
  PERFORM public.mcp_inbox_assert_member(p_user_id, p_organization_id);
  v_channel := public.mcp_inbox_check_channel(p_channel);
  SELECT b.v_from, b.v_to INTO v_from, v_to FROM public.mcp_inbox_bounds(p_start, p_end) b;

  RETURN QUERY
  WITH stats AS (
    SELECT pm.channel, pm.conversation_id,
           COUNT(*) FILTER (WHERE pm.direction = 'inbound')::integer AS inbound_n,
           COUNT(*) FILTER (WHERE pm.direction = 'outbound')::integer AS outbound_n
    FROM public.mcp_inbox_period_messages(p_organization_id, p_employee_id, v_channel, v_from, v_to) pm
    GROUP BY pm.channel, pm.conversation_id
  )
  SELECT b.conversation_id,
         b.channel,
         b.customer_name,
         b.ticket_id,
         ls.name,
         e.full_name,
         b.from_ad,
         b.first_inbound_at,
         b.last_at,
         b.last_direction,
         left(COALESCE(NULLIF(btrim(b.last_body), ''), '[' || COALESCE(b.last_type, 'message') || ']'), 200),
         b.last_direction = 'inbound',
         CASE WHEN b.last_direction = 'inbound'
              THEN GREATEST(0, floor(extract(epoch FROM (now() - b.last_at)) / 60))::integer
         END,
         s.inbound_n,
         s.outbound_n
  FROM public.mcp_inbox_conversation_base(p_organization_id, p_employee_id, v_channel) b
  JOIN stats s ON s.channel = b.channel AND s.conversation_id = b.conversation_id
  LEFT JOIN public.lead_statuses ls ON ls.id = b.lead_status_id
  LEFT JOIN public.employees e ON e.id = b.assignee_id
  WHERE NOT COALESCE(p_awaiting_only, false) OR b.last_direction = 'inbound'
  ORDER BY (b.last_direction = 'inbound') DESC, b.last_at DESC NULLS LAST, b.conversation_id
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_inbox_messages(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_conversation_id uuid,
  p_limit integer
)
RETURNS TABLE (
  message_id uuid,
  direction text,
  sent_by text,
  message_type text,
  body text,
  has_media boolean,
  reply_to_body text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.mcp_inbox_assert_member(p_user_id, p_organization_id);
  v_channel := public.mcp_inbox_check_channel(p_channel);
  IF v_channel IS NULL OR p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mcp_inbox_conversation_base(p_organization_id, p_employee_id, v_channel) b
    WHERE b.conversation_id = p_conversation_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_channel = 'instagram' THEN
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer' ELSE 'agent' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.instagram_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  ELSIF v_channel = 'facebook' THEN
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer' ELSE 'agent' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.facebook_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  ELSE
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer'
                  WHEN COALESCE(m.source, 'agent') = 'agent' THEN 'agent'
                  ELSE 'automation' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.whatsapp_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  END IF;
END;
$$;

-- First reply: for each customer turn (an inbound message whose previous
-- message in the period is not inbound), minutes until the next human reply.
CREATE OR REPLACE FUNCTION public.mcp_inbox_summary(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_start date,
  p_end date
)
RETURNS TABLE (
  channel text,
  conversations integer,
  new_conversations integer,
  from_ad_conversations integer,
  inbound_messages integer,
  outbound_messages integer,
  awaiting_reply integer,
  customer_turns integer,
  replied_turns integer,
  replied_within_5m integer,
  median_first_reply_minutes numeric,
  avg_first_reply_minutes numeric,
  inbound_by_hour jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text;
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  PERFORM public.mcp_inbox_assert_member(p_user_id, p_organization_id);
  v_channel := public.mcp_inbox_check_channel(p_channel);
  SELECT b.v_from, b.v_to INTO v_from, v_to FROM public.mcp_inbox_bounds(p_start, p_end) b;

  RETURN QUERY
  WITH pm AS (
    SELECT * FROM public.mcp_inbox_period_messages(p_organization_id, p_employee_id, v_channel, v_from, v_to)
  ),
  ordered AS (
    SELECT pm.*,
           lag(pm.direction) OVER w AS prev_direction
    FROM pm
    WINDOW w AS (PARTITION BY pm.channel, pm.conversation_id ORDER BY pm.created_at, pm.message_id)
  ),
  turns AS (
    SELECT o.channel, o.conversation_id, o.created_at AS asked_at,
           (SELECT min(r.created_at) FROM pm r
             WHERE r.channel = o.channel AND r.conversation_id = o.conversation_id
               AND r.is_human_reply AND r.created_at > o.created_at) AS replied_at
    FROM ordered o
    WHERE o.direction = 'inbound' AND COALESCE(o.prev_direction, 'outbound') <> 'inbound'
  ),
  turn_stats AS (
    SELECT t.channel,
           COUNT(*)::integer AS turns_n,
           COUNT(t.replied_at)::integer AS replied_n,
           COUNT(*) FILTER (WHERE t.replied_at - t.asked_at <= interval '5 minutes')::integer AS fast_n,
           round((percentile_cont(0.5) WITHIN GROUP (
             ORDER BY extract(epoch FROM (t.replied_at - t.asked_at)) / 60
           ) FILTER (WHERE t.replied_at IS NOT NULL))::numeric, 1) AS median_m,
           round((avg(extract(epoch FROM (t.replied_at - t.asked_at)) / 60)
             FILTER (WHERE t.replied_at IS NOT NULL))::numeric, 1) AS avg_m
    FROM turns t
    GROUP BY t.channel
  ),
  msg_stats AS (
    SELECT pm.channel,
           COUNT(DISTINCT pm.conversation_id)::integer AS conv_n,
           COUNT(*) FILTER (WHERE pm.direction = 'inbound')::integer AS in_n,
           COUNT(*) FILTER (WHERE pm.direction = 'outbound')::integer AS out_n
    FROM pm
    GROUP BY pm.channel
  ),
  hours AS (
    SELECT h.channel, jsonb_object_agg(lpad(h.hr::text, 2, '0'), h.n ORDER BY h.hr) AS by_hour
    FROM (
      SELECT pm.channel,
             extract(hour FROM pm.created_at AT TIME ZONE 'Asia/Jakarta')::integer AS hr,
             COUNT(*)::integer AS n
      FROM pm
      WHERE pm.direction = 'inbound'
      GROUP BY 1, 2
    ) h
    GROUP BY h.channel
  ),
  conv_stats AS (
    SELECT b.channel,
           COUNT(*) FILTER (WHERE b.first_inbound_at >= v_from AND b.first_inbound_at < v_to)::integer AS new_n,
           COUNT(*) FILTER (WHERE b.from_ad)::integer AS ad_n,
           COUNT(*) FILTER (WHERE b.last_direction = 'inbound')::integer AS waiting_n
    FROM public.mcp_inbox_conversation_base(p_organization_id, p_employee_id, v_channel) b
    WHERE EXISTS (
      SELECT 1 FROM pm WHERE pm.channel = b.channel AND pm.conversation_id = b.conversation_id
    )
    GROUP BY b.channel
  )
  SELECT ms.channel,
         ms.conv_n,
         COALESCE(cs.new_n, 0),
         COALESCE(cs.ad_n, 0),
         ms.in_n,
         ms.out_n,
         COALESCE(cs.waiting_n, 0),
         COALESCE(ts.turns_n, 0),
         COALESCE(ts.replied_n, 0),
         COALESCE(ts.fast_n, 0),
         ts.median_m,
         ts.avg_m,
         COALESCE(h.by_hour, '{}'::jsonb)
  FROM msg_stats ms
  LEFT JOIN turn_stats ts ON ts.channel = ms.channel
  LEFT JOIN conv_stats cs ON cs.channel = ms.channel
  LEFT JOIN hours h ON h.channel = ms.channel
  ORDER BY ms.channel;
END;
$$;

DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.mcp_inbox_assert_member(uuid, uuid)',
    'public.mcp_inbox_conversation_base(uuid, uuid, text)',
    'public.mcp_inbox_period_messages(uuid, uuid, text, timestamptz, timestamptz)',
    'public.mcp_inbox_bounds(date, date)',
    'public.mcp_inbox_check_channel(text)',
    'public.mcp_inbox_conversations(uuid, uuid, uuid, text, date, date, boolean, integer)',
    'public.mcp_inbox_messages(uuid, uuid, uuid, text, uuid, integer)',
    'public.mcp_inbox_summary(uuid, uuid, uuid, text, date, date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
