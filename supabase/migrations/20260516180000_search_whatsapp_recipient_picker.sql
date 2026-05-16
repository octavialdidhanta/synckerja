-- WhatsApp campaign recipient picker: server-side search + filters (parity with Leads Management).
-- p_filters jsonb keys (see recipientPickerFilterSpec.ts):
--   dataCompleteness, services, category, createdBy, assignee, fuPriority, status, source,
--   search, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, attributionLabel,
--   landingUrlContains, dateRangeFrom, dateRangeTo (ISO date YYYY-MM-DD).
--
-- Semantics:
-- - Lead-only filters (non-"all"): rows without lead_id (livechat-only) never match.
-- - dataCompleteness != 'all': livechat-only rows excluded (no client profile by lead).
-- - Effective status: WhatsApp conversation overrides lead when ticket matches; outside 24h
--   from last_inbound_at (fallback created_at) uses first active "Closed" or "Resolve" status id.
-- - Effective assignee: conversation.assignee_id overrides lead.assignee_id when ticket matches.

CREATE OR REPLACE FUNCTION public.normalize_wa_phone_key(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  d := regexp_replace(btrim(p_text), '\D', '', 'g');
  IF d = '' OR d IS NULL THEN
    RETURN NULL;
  END IF;
  IF left(d, 1) = '0' AND length(d) >= 10 THEN
    d := '62' || substr(d, 2);
  END IF;
  IF left(d, 2) <> '62' AND left(d, 1) = '8' AND length(d) >= 9 AND length(d) <= 12 THEN
    d := '62' || d;
  END IF;
  IF length(d) < 8 OR length(d) > 18 THEN
    RETURN NULL;
  END IF;
  RETURN d;
END;
$$;

COMMENT ON FUNCTION public.normalize_wa_phone_key(text) IS 'Digit-only WA key (62…); aligns with app normalizeWaPhoneKey.';

CREATE OR REPLACE FUNCTION public._crm_norm_ticket(p_ticket text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p_ticket IS NULL OR btrim(p_ticket) = '' THEN NULL
    ELSE upper(btrim(p_ticket))
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.recipient_picker_filter_options(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT public.user_is_org_owner(p_organization_id) INTO v_ok;
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN jsonb_build_object(
    'created_by_names',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(l.created_by_name) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND btrim(coalesce(l.created_by_name, '')) <> ''
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'utm_sources',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution ->> 'utm_source', '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution ->> 'utm_source'), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'utm_mediums',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution ->> 'utm_medium', '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution ->> 'utm_medium'), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'utm_campaigns',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution ->> 'utm_campaign', '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution ->> 'utm_campaign'), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'utm_contents',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution ->> 'utm_content', '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution ->> 'utm_content'), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'utm_terms',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution ->> 'utm_term', '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution ->> 'utm_term'), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'attribution_labels',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.attribution_label, '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.attribution_label), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    )
  );
END;
$$;

COMMENT ON FUNCTION public.recipient_picker_filter_options(uuid) IS 'Distinct filter option values for recipient picker (org owner only).';

CREATE OR REPLACE FUNCTION public.search_whatsapp_recipient_picker(
  p_organization_id uuid,
  p_filters jsonb,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_resolved_status_id uuid;
  v_lim integer := greatest(coalesce(p_limit, 50), 1);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  END IF;
  SELECT public.user_is_org_owner(p_organization_id) INTO v_ok;
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT ls.id
  INTO v_resolved_status_id
  FROM public.lead_statuses ls
  WHERE (ls.organization_id = p_organization_id OR ls.organization_id IS NULL)
    AND coalesce(ls.is_active, true)
    AND lower(btrim(ls.name)) IN ('closed', 'resolve')
  ORDER BY CASE WHEN lower(btrim(ls.name)) = 'closed' THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN (
  WITH f AS (
    SELECT coalesce(p_filters, '{}'::jsonb) AS j
  ),
  emp AS (
    SELECT e.id, coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(e.email), '')) AS disp
    FROM public.employees e
  ),
  lead_prof AS (
    SELECT DISTINCT ON (p.lead_id)
      p.lead_id,
      p.phone_number AS prof_phone,
      p.contact_phone AS prof_contact_phone,
      p.name AS prof_name,
      p.code AS prof_code,
      p.gender AS prof_gender,
      p.age AS prof_age,
      p.occupation AS prof_occupation,
      p.location AS prof_location,
      p.email AS prof_email
    FROM public.lead_client_profiles p
    WHERE p.organization_id = p_organization_id
    ORDER BY p.lead_id, p.updated_at DESC NULLS LAST
  ),
  wa_conv AS (
    SELECT
      c.id,
      c.ticket_id,
      c.customer_wa_id,
      c.customer_name,
      c.channel,
      c.lead_status_id,
      c.assignee_id,
      c.last_inbound_at,
      c.created_at AS conv_created_at
    FROM public.whatsapp_conversations c
    WHERE c.organization_id = p_organization_id
      AND lower(coalesce(c.channel, 'whatsapp')) <> 'instagram'
  ),
  wa_prof AS (
    SELECT wcp.conversation_id, wcp.phone_number AS wcp_phone
    FROM public.whatsapp_conversation_client_profiles wcp
    WHERE wcp.organization_id = p_organization_id
  ),
  lead_base AS (
    SELECT
      l.id AS lead_id,
      l.ticket_id,
      l.client,
      l.title,
      l.services,
      l.category,
      l.created_by,
      l.created_by_name,
      l.source,
      l.followup,
      l.fu_priority,
      l.status_id AS lead_status_id_raw,
      l.assignee_id AS lead_assignee_id_raw,
      l.assignee AS lead_assignee_text_raw,
      l.created_at,
      l.updated_at,
      l.organization_id,
      l.phone_number AS lead_phone_raw,
      l.attribution,
      l.attribution_label,
      wc.id AS conv_id,
      wc.customer_wa_id,
      wc.customer_name,
      wc.lead_status_id AS conv_status_id,
      wc.assignee_id AS conv_assignee_id,
      wc.last_inbound_at,
      wc.conv_created_at,
      prof.prof_phone,
      prof.prof_contact_phone,
      prof.prof_name,
      prof.prof_code,
      prof.prof_gender,
      prof.prof_age,
      prof.prof_occupation,
      prof.prof_location,
      prof.prof_email,
      wp.wcp_phone,
      public._crm_norm_ticket(l.ticket_id) AS nticket,
      CASE
        WHEN wc.id IS NOT NULL
          AND v_resolved_status_id IS NOT NULL
          AND (coalesce(wc.last_inbound_at, wc.conv_created_at) IS NOT NULL)
          AND (now() - coalesce(wc.last_inbound_at, wc.conv_created_at)) > interval '24 hours'
        THEN v_resolved_status_id
        ELSE coalesce(wc.lead_status_id, l.status_id)
      END AS eff_status_id,
      coalesce(wc.assignee_id, l.assignee_id) AS eff_assignee_id,
      coalesce(
        nullif(btrim(prof.prof_phone), ''),
        nullif(btrim(prof.prof_contact_phone), ''),
        nullif(btrim(l.phone_number), ''),
        nullif(btrim(wp.wcp_phone), ''),
        nullif(btrim(wc.customer_wa_id), '')
      ) AS raw_phone
    FROM public.leads l
    LEFT JOIN lead_prof prof ON prof.lead_id = l.id
    LEFT JOIN wa_conv wc
      ON public._crm_norm_ticket(wc.ticket_id) IS NOT DISTINCT FROM public._crm_norm_ticket(l.ticket_id)
    LEFT JOIN wa_prof wp ON wp.conversation_id = wc.id
    WHERE l.organization_id = p_organization_id
  ),
  lead_with_phone AS (
    SELECT
      lb.*,
      public.normalize_wa_phone_key(lb.raw_phone) AS phone_key,
      (
        SELECT ls2.name
        FROM public.lead_statuses ls2
        WHERE ls2.id = lb.eff_status_id
        LIMIT 1
      ) AS eff_status_name,
      coalesce(ed.disp, lb.lead_assignee_text_raw, '') AS eff_assignee_label
    FROM lead_base lb
    LEFT JOIN emp ed ON ed.id = lb.eff_assignee_id
    WHERE public.normalize_wa_phone_key(lb.raw_phone) IS NOT NULL
  ),
  lead_dc AS (
    SELECT
      lp.*,
      (
        SELECT
          CASE
            WHEN cnt = 0 THEN 'empty'::text
            WHEN cnt >= 8 THEN 'full'::text
            ELSE 'partial'::text
          END
        FROM (
          SELECT
            (
              CASE WHEN lp.prof_name IS NOT NULL AND btrim(lp.prof_name::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_code IS NOT NULL AND btrim(lp.prof_code::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_gender IS NOT NULL AND btrim(lp.prof_gender::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_age IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_occupation IS NOT NULL AND btrim(lp.prof_occupation::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_location IS NOT NULL AND btrim(lp.prof_location::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_phone IS NOT NULL AND btrim(lp.prof_phone::text) <> '' THEN 1 ELSE 0 END +
              CASE WHEN lp.prof_email IS NOT NULL AND btrim(lp.prof_email::text) <> '' THEN 1 ELSE 0 END
            ) AS cnt
        ) x
      ) AS data_completeness
    FROM lead_with_phone lp
  ),
  lead_tickets AS (
    SELECT DISTINCT nticket
    FROM lead_dc
    WHERE nticket IS NOT NULL
  ),
  livechat_only AS (
    SELECT
      wc.id AS conv_id,
      NULL::uuid AS lead_id,
      wc.ticket_id,
      coalesce(nullif(btrim(wc.customer_name), ''), public.normalize_wa_phone_key(wc.customer_wa_id)) AS client,
      'WhatsApp'::text AS title,
      NULL::text AS services,
      ''::text AS category,
      NULL::uuid AS created_by,
      ''::text AS created_by_name,
      'WhatsApp'::text AS source,
      0::integer AS followup,
      'Medium'::text AS fu_priority,
      wc.lead_status_id AS lead_status_id_raw,
      wc.assignee_id AS lead_assignee_id_raw,
      coalesce(ed.disp, '') AS lead_assignee_text_raw,
      wc.conv_created_at AS created_at,
      wc.conv_created_at AS updated_at,
      p_organization_id AS organization_id,
      wc.customer_wa_id AS lead_phone_raw,
      NULL::jsonb AS attribution,
      NULL::text AS attribution_label,
      wc.customer_name,
      wc.lead_status_id AS conv_status_id,
      wc.assignee_id AS conv_assignee_id,
      wc.last_inbound_at,
      wc.conv_created_at,
      NULL::uuid AS prof_lead_id,
      NULL::text AS prof_phone,
      NULL::text AS prof_contact_phone,
      NULL::text AS prof_name,
      NULL::text AS prof_code,
      NULL::text AS prof_gender,
      NULL::integer AS prof_age,
      NULL::text AS prof_occupation,
      NULL::text AS prof_location,
      NULL::text AS prof_email,
      wp.wcp_phone,
      public._crm_norm_ticket(wc.ticket_id) AS nticket,
      CASE
        WHEN v_resolved_status_id IS NOT NULL
          AND (coalesce(wc.last_inbound_at, wc.conv_created_at) IS NOT NULL)
          AND (now() - coalesce(wc.last_inbound_at, wc.conv_created_at)) > interval '24 hours'
        THEN v_resolved_status_id
        ELSE wc.lead_status_id
      END AS eff_status_id,
      wc.assignee_id AS eff_assignee_id,
      coalesce(nullif(btrim(wp.wcp_phone), ''), nullif(btrim(wc.customer_wa_id), '')) AS raw_phone
    FROM wa_conv wc
    LEFT JOIN wa_prof wp ON wp.conversation_id = wc.id
    LEFT JOIN emp ed ON ed.id = wc.assignee_id
    WHERE
      (
        public._crm_norm_ticket(wc.ticket_id) IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM lead_tickets t WHERE t.nticket = public._crm_norm_ticket(wc.ticket_id)
        )
      )
      AND public.normalize_wa_phone_key(
        coalesce(nullif(btrim(wp.wcp_phone), ''), nullif(btrim(wc.customer_wa_id), ''))
      ) IS NOT NULL
  ),
  livechat_dc AS (
    SELECT
      lo.*,
      public.normalize_wa_phone_key(lo.raw_phone) AS phone_key,
      (
        SELECT ls2.name
        FROM public.lead_statuses ls2
        WHERE ls2.id = lo.eff_status_id
        LIMIT 1
      ) AS eff_status_name,
      coalesce(ed.disp, lo.lead_assignee_text_raw, '') AS eff_assignee_label,
      NULL::text AS utm_source,
      NULL::text AS utm_medium,
      NULL::text AS utm_campaign,
      NULL::text AS utm_content,
      NULL::text AS utm_term,
      NULL::text AS landing_url,
      NULL::text AS data_completeness
    FROM livechat_only lo
    LEFT JOIN emp ed ON ed.id = lo.eff_assignee_id
  ),
  unioned AS (
    SELECT
      ldc.lead_id,
      ldc.conv_id,
      ldc.phone_key,
      CASE WHEN ldc.lead_id IS NOT NULL THEN 'lead' ELSE 'livechat' END AS picker_origin,
      CASE
        WHEN ldc.lead_id IS NOT NULL THEN ldc.lead_id::text
        ELSE 'lc-' || ldc.conv_id::text
      END AS row_id,
      nullif(btrim(ldc.raw_phone), '') AS display_phone_raw,
      ldc.client,
      ldc.title,
      ldc.services,
      ldc.category,
      ldc.created_by_name,
      ldc.source,
      ldc.followup,
      ldc.fu_priority,
      ldc.eff_status_id,
      ldc.eff_status_name,
      ldc.eff_assignee_id,
      ldc.eff_assignee_label,
      ldc.created_at,
      ldc.updated_at,
      ldc.organization_id,
      ldc.ticket_id,
      nullif(btrim(ldc.attribution ->> 'utm_source'), '') AS utm_source,
      nullif(btrim(ldc.attribution ->> 'utm_medium'), '') AS utm_medium,
      nullif(btrim(ldc.attribution ->> 'utm_campaign'), '') AS utm_campaign,
      nullif(btrim(ldc.attribution ->> 'utm_content'), '') AS utm_content,
      nullif(btrim(ldc.attribution ->> 'utm_term'), '') AS utm_term,
      nullif(btrim(ldc.attribution ->> 'landing_url'), '') AS landing_url,
      ldc.attribution_label,
      ldc.data_completeness
    FROM lead_dc ldc
    UNION ALL
    SELECT
      lcd.lead_id,
      lcd.conv_id,
      lcd.phone_key,
      'livechat'::text,
      'lc-' || lcd.conv_id::text,
      nullif(btrim(lcd.raw_phone), ''),
      lcd.client,
      lcd.title,
      lcd.services,
      lcd.category,
      lcd.created_by_name,
      lcd.source,
      lcd.followup,
      lcd.fu_priority,
      lcd.eff_status_id,
      lcd.eff_status_name,
      lcd.eff_assignee_id,
      lcd.eff_assignee_label,
      lcd.created_at,
      lcd.updated_at,
      lcd.organization_id,
      lcd.ticket_id,
      lcd.utm_source,
      lcd.utm_medium,
      lcd.utm_campaign,
      lcd.utm_content,
      lcd.utm_term,
      lcd.landing_url,
      lcd.attribution_label,
      lcd.data_completeness
    FROM livechat_dc lcd
  ),
  dedup AS (
    SELECT DISTINCT ON (u.phone_key)
      u.*
    FROM unioned u
    ORDER BY u.phone_key, CASE WHEN u.picker_origin = 'lead' THEN 0 ELSE 1 END, u.created_at DESC
  ),
  filtered AS (
    SELECT d.*
    FROM dedup d, f
    WHERE
      (coalesce(f.j ->> 'search', '') = '' OR (
        lower(coalesce(d.client, '')) LIKE '%' || lower(btrim(f.j ->> 'search')) || '%'
        OR lower(coalesce(d.title, '')) LIKE '%' || lower(btrim(f.j ->> 'search')) || '%'
        OR lower(coalesce(d.ticket_id, '')) LIKE '%' || lower(btrim(f.j ->> 'search')) || '%'
        OR (
          length(regexp_replace(coalesce(f.j ->> 'search', ''), '\D', '', 'g')) >= 6
          AND d.phone_key LIKE '%' || regexp_replace(lower(btrim(f.j ->> 'search')), '\D', '', 'g') || '%'
        )
      ))
      AND (
        coalesce(f.j ->> 'dataCompleteness', 'all') = 'all'
        OR (d.lead_id IS NOT NULL AND d.data_completeness = (f.j ->> 'dataCompleteness'))
      )
      AND (coalesce(f.j ->> 'services', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.services, '') = (f.j ->> 'services')))
      AND (coalesce(f.j ->> 'category', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.category, '') = (f.j ->> 'category')))
      AND (coalesce(f.j ->> 'createdBy', 'all') = 'all' OR (d.lead_id IS NOT NULL AND btrim(coalesce(d.created_by_name, '')) = btrim(f.j ->> 'createdBy')))
      AND (coalesce(f.j ->> 'assignee', 'all') = 'all' OR (d.lead_id IS NOT NULL AND btrim(d.eff_assignee_label) = btrim(f.j ->> 'assignee')))
      AND (
        coalesce(f.j ->> 'fuPriority', 'all') = 'all'
        OR (
          d.lead_id IS NOT NULL
          AND (
            ((f.j ->> 'fuPriority') = 'Please Follow Up' AND coalesce(d.followup, 0) = 0)
            OR ((f.j ->> 'fuPriority') <> 'Please Follow Up' AND coalesce(d.fu_priority, '') = (f.j ->> 'fuPriority'))
          )
        )
      )
      AND (
        coalesce(f.j ->> 'status', 'all') = 'all'
        OR (
          d.lead_id IS NOT NULL
          AND lower(btrim(coalesce(d.eff_status_name, ''))) = lower(btrim(f.j ->> 'status'))
        )
      )
      AND (coalesce(f.j ->> 'source', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.source, '') = (f.j ->> 'source')))
      AND (coalesce(f.j ->> 'utmSource', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_source, '') = (f.j ->> 'utmSource')))
      AND (coalesce(f.j ->> 'utmMedium', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_medium, '') = (f.j ->> 'utmMedium')))
      AND (coalesce(f.j ->> 'utmCampaign', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_campaign, '') = (f.j ->> 'utmCampaign')))
      AND (coalesce(f.j ->> 'utmContent', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_content, '') = (f.j ->> 'utmContent')))
      AND (coalesce(f.j ->> 'utmTerm', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_term, '') = (f.j ->> 'utmTerm')))
      AND (coalesce(f.j ->> 'attributionLabel', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.attribution_label, '') = (f.j ->> 'attributionLabel')))
      AND (
        coalesce(f.j ->> 'landingUrlContains', '') = ''
        OR (
          d.lead_id IS NOT NULL
          AND lower(coalesce(d.landing_url, '')) LIKE '%' || lower(btrim(f.j ->> 'landingUrlContains')) || '%'
        )
      )
      AND (
        f.j ->> 'dateRangeFrom' IS NULL
        OR f.j ->> 'dateRangeFrom' = ''
        OR f.j ->> 'dateRangeTo' IS NULL
        OR f.j ->> 'dateRangeTo' = ''
        OR (
          d.lead_id IS NOT NULL
          AND d.created_at::date >= (f.j ->> 'dateRangeFrom')::date
          AND d.created_at::date <= (f.j ->> 'dateRangeTo')::date
        )
      )
  ),
  paged AS (
    SELECT
      row_number() OVER (ORDER BY d.client ASC NULLS LAST, d.phone_key ASC) AS rn,
      d.*
    FROM filtered d
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::bigint FROM filtered),
    'items',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.row_id,
            'client', p.client,
            'title', p.title,
            'services', p.services,
            'category', p.category,
            'assignee', p.eff_assignee_label,
            'assignee_id', p.eff_assignee_id,
            'fu_priority', p.fu_priority,
            'status_id', p.eff_status_id,
            'source', p.source,
            'followup', p.followup,
            'converted_at', NULL,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'created_by', coalesce(p.created_by_name, ''),
            'created_by_name', p.created_by_name,
            'organization_id', p.organization_id,
            'ticket_id', p.ticket_id,
            'utm_source', p.utm_source,
            'utm_medium', p.utm_medium,
            'utm_campaign', p.utm_campaign,
            'utm_content', p.utm_content,
            'utm_term', p.utm_term,
            'landing_url', p.landing_url,
            'attribution_label', p.attribution_label,
            'lead_status', jsonb_build_object(
              'id', p.eff_status_id,
              'name', p.eff_status_name,
              'color', (
                SELECT ls3.color FROM public.lead_statuses ls3 WHERE ls3.id = p.eff_status_id LIMIT 1
              )
            ),
            '_phone_normalized', p.phone_key,
            '_display_phone', coalesce(nullif(p.display_phone_raw, ''), p.phone_key),
            '_conversation_id', p.conv_id,
            '_picker_origin', p.picker_origin,
            '_lead_id', p.lead_id
          ) ORDER BY p.rn
        )
        FROM paged p
        WHERE p.rn > v_off AND p.rn <= v_off + v_lim
      ),
      '[]'::jsonb
    )
  )
  );
END;
$$;

COMMENT ON FUNCTION public.search_whatsapp_recipient_picker(uuid, jsonb, integer, integer) IS
'JSON {total, items[]} for WhatsApp recipient picker; filters match Leads Management (see migration header).';

GRANT EXECUTE ON FUNCTION public.normalize_wa_phone_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._crm_norm_ticket(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recipient_picker_filter_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_recipient_picker(uuid, jsonb, integer, integer) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_leads_org_created_at
  ON public.leads (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_created_by_name
  ON public.leads (organization_id, created_by_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org_channel
  ON public.whatsapp_conversations (organization_id, channel)
  WHERE lower(coalesce(channel, 'whatsapp')) <> 'instagram';
