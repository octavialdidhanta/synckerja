-- Recipient picker: Lead Magnet campaign + target market columns and server-side filters.

-- Re-apply search_whatsapp_recipient_picker (from 20260526140000 + LM snapshot fields).
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
  v_expired_status_id uuid;
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
  INTO v_expired_status_id
  FROM public.lead_statuses ls
  WHERE (ls.organization_id = p_organization_id OR ls.organization_id IS NULL)
    AND coalesce(ls.is_active, true)
    AND lower(btrim(ls.name)) = 'expired'
  ORDER BY CASE WHEN ls.organization_id = p_organization_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN (
  WITH f AS (
    SELECT coalesce(p_filters, '{}'::jsonb) AS j
  ),
  latest_survey AS (
    SELECT DISTINCT ON (r.whatsapp_conversation_id)
      r.whatsapp_conversation_id,
      r.rating AS latest_survey_rating,
      r.comment AS latest_survey_comment,
      r.submitted_at AS latest_survey_submitted_at
    FROM public.customer_survey_responses r
    WHERE r.organization_id = p_organization_id
    ORDER BY r.whatsapp_conversation_id, r.submitted_at DESC
  ),
  emp AS (
    SELECT e.id, coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(e.email), '')) AS disp
    FROM public.employees e
  ),
  lead_sub_ranked AS (
    SELECT
      s.lead_id,
      s.phone_number AS prof_phone,
      NULL::text AS prof_contact_phone,
      s.name AS prof_name,
      s.code AS prof_code,
      s.gender AS prof_gender,
      s.age AS prof_age,
      s.occupation AS prof_occupation,
      s.location AS prof_location,
      s.email AS prof_email,
      s.lead_magnet_campaign_name AS prof_lm_campaign,
      s.lead_magnet_target_market AS prof_lm_target_market,
      ROW_NUMBER() OVER (
        PARTITION BY s.lead_id
        ORDER BY
          CASE
            WHEN s.status = 'submitted' THEN 0
            WHEN s.status = 'draft' THEN 1
            ELSE 2
          END,
          s.submitted_at DESC NULLS LAST,
          s.updated_at DESC NULLS LAST
      ) AS rn
    FROM public.lead_submissions s
    WHERE s.organization_id = p_organization_id
      AND s.is_active = true
      AND s.lead_id IS NOT NULL
  ),
  lead_prof AS (
    SELECT
      lead_id,
      prof_phone,
      prof_contact_phone,
      prof_name,
      prof_code,
      prof_gender,
      prof_age,
      prof_occupation,
      prof_location,
      prof_email,
      prof_lm_campaign,
      prof_lm_target_market
    FROM lead_sub_ranked
    WHERE rn = 1
  ),
  lm_snapshot_by_phone AS (
    SELECT DISTINCT ON (public.normalize_wa_phone_key(s.phone_number))
      public.normalize_wa_phone_key(s.phone_number) AS phone_key,
      btrim(s.lead_magnet_campaign_name) AS lead_magnet_campaign_name,
      btrim(s.lead_magnet_target_market) AS lead_magnet_target_market
    FROM public.lead_submissions s
    WHERE s.organization_id = p_organization_id
      AND s.is_active = true
      AND s.phone_number IS NOT NULL
      AND s.lead_magnet_target_market IS NOT NULL
      AND btrim(s.lead_magnet_target_market) <> ''
    ORDER BY
      public.normalize_wa_phone_key(s.phone_number),
      s.submitted_at DESC NULLS LAST,
      s.updated_at DESC NULLS LAST
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
      c.created_at AS conv_created_at,
      c.meta_session_expires_at
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
      l.gclid,
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
      prof.prof_lm_campaign,
      prof.prof_lm_target_market,
      wp.wcp_phone,
      public._crm_norm_ticket(l.ticket_id) AS nticket,
      CASE
        WHEN wc.id IS NOT NULL
          AND v_expired_status_id IS NOT NULL
          AND wc.meta_session_expires_at IS NOT NULL
          AND wc.meta_session_expires_at < now()
          AND NOT EXISTS (
            SELECT 1
            FROM public.lead_statuses lsx
            WHERE lsx.id = coalesce(wc.lead_status_id, l.status_id)
              AND lower(btrim(lsx.name)) IN ('closed', 'lost', 'converted')
          )
        THEN v_expired_status_id
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
  lead_enriched AS (
    SELECT
      lb.*,
      public.normalize_wa_phone_key(lb.raw_phone) AS phone_key,
      (
        SELECT ls2.name
        FROM public.lead_statuses ls2
        WHERE ls2.id = lb.eff_status_id
        LIMIT 1
      ) AS eff_status_name,
      coalesce(ed.disp, lb.lead_assignee_text_raw, '') AS eff_assignee_label,
      nullif(
        btrim(coalesce(nullif(btrim(lb.prof_lm_campaign), ''), lmp.lead_magnet_campaign_name)),
        ''
      ) AS lead_magnet_campaign_name,
      nullif(
        btrim(coalesce(nullif(btrim(lb.prof_lm_target_market), ''), lmp.lead_magnet_target_market)),
        ''
      ) AS lead_magnet_target_market
    FROM lead_base lb
    LEFT JOIN emp ed ON ed.id = lb.eff_assignee_id
    LEFT JOIN lm_snapshot_by_phone lmp ON lmp.phone_key = public.normalize_wa_phone_key(lb.raw_phone)
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
    FROM lead_enriched lp
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
        WHEN v_expired_status_id IS NOT NULL
          AND wc.meta_session_expires_at IS NOT NULL
          AND wc.meta_session_expires_at < now()
          AND NOT EXISTS (
            SELECT 1
            FROM public.lead_statuses lsx
            WHERE lsx.id = wc.lead_status_id
              AND lower(btrim(lsx.name)) IN ('closed', 'lost', 'converted')
          )
        THEN v_expired_status_id
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
      NULL::text AS gclid,
      NULL::text AS display_email,
      NULL::text AS data_completeness,
      nullif(btrim(lmp.lead_magnet_campaign_name), '') AS lead_magnet_campaign_name,
      nullif(btrim(lmp.lead_magnet_target_market), '') AS lead_magnet_target_market
    FROM livechat_only lo
    LEFT JOIN emp ed ON ed.id = lo.eff_assignee_id
    LEFT JOIN lm_snapshot_by_phone lmp ON lmp.phone_key = public.normalize_wa_phone_key(lo.raw_phone)
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
      ldc.gclid,
      nullif(btrim(ldc.prof_email), '') AS display_email,
      ldc.data_completeness,
      ldc.lead_magnet_campaign_name,
      ldc.lead_magnet_target_market
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
      lcd.gclid,
      lcd.display_email,
      lcd.data_completeness,
      lcd.lead_magnet_campaign_name,
      lcd.lead_magnet_target_market
    FROM livechat_dc lcd
  ),
  dedup AS (
    SELECT DISTINCT ON (u.row_id)
      u.*
    FROM unioned u
    ORDER BY u.row_id, u.created_at DESC
  ),
  dedup_enriched AS (
    SELECT
      d.*,
      ls.latest_survey_rating,
      ls.latest_survey_comment,
      ls.latest_survey_submitted_at
    FROM dedup d
    LEFT JOIN latest_survey ls ON ls.whatsapp_conversation_id = d.conv_id
  ),
  filtered AS (
    SELECT d.*
    FROM dedup_enriched d, f
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
      AND (coalesce(f.j ->> 'assignee', 'all') = 'all' OR btrim(coalesce(d.eff_assignee_label, '')) = btrim(f.j ->> 'assignee'))
      AND (
        coalesce(f.j ->> 'fuPriority', 'all') = 'all'
        OR (
          ((f.j ->> 'fuPriority') = 'Please Follow Up' AND coalesce(d.followup, 0) = 0)
          OR ((f.j ->> 'fuPriority') <> 'Please Follow Up' AND coalesce(d.fu_priority, '') = (f.j ->> 'fuPriority'))
        )
      )
      AND (
        coalesce(f.j ->> 'status', 'all') = 'all'
        OR lower(btrim(coalesce(d.eff_status_name, ''))) = lower(btrim(f.j ->> 'status'))
      )
      AND (coalesce(f.j ->> 'source', 'all') = 'all' OR coalesce(d.source, '') = (f.j ->> 'source'))
      AND (coalesce(f.j ->> 'utmSource', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_source, '') = (f.j ->> 'utmSource')))
      AND (coalesce(f.j ->> 'utmMedium', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_medium, '') = (f.j ->> 'utmMedium')))
      AND (coalesce(f.j ->> 'utmCampaign', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_campaign, '') = (f.j ->> 'utmCampaign')))
      AND (coalesce(f.j ->> 'utmContent', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_content, '') = (f.j ->> 'utmContent')))
      AND (coalesce(f.j ->> 'utmTerm', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.utm_term, '') = (f.j ->> 'utmTerm')))
      AND (coalesce(f.j ->> 'attributionLabel', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.attribution_label, '') = (f.j ->> 'attributionLabel')))
      AND (coalesce(f.j ->> 'gclid', 'all') = 'all' OR (d.lead_id IS NOT NULL AND coalesce(d.gclid, '') = (f.j ->> 'gclid')))
      AND (
        coalesce(f.j ->> 'gclidPresence', 'all') = 'all'
        OR (
          coalesce(f.j ->> 'gclidPresence', 'all') = 'has'
          AND d.lead_id IS NOT NULL
          AND btrim(coalesce(d.gclid, '')) <> ''
        )
        OR (
          coalesce(f.j ->> 'gclidPresence', 'all') = 'none'
          AND (d.lead_id IS NULL OR btrim(coalesce(d.gclid, '')) = '')
        )
      )
      AND (
        coalesce(f.j ->> 'emailPresence', 'all') = 'all'
        OR (
          coalesce(f.j ->> 'emailPresence', 'all') = 'has'
          AND btrim(coalesce(d.display_email, '')) <> ''
        )
        OR (
          coalesce(f.j ->> 'emailPresence', 'all') = 'none'
          AND btrim(coalesce(d.display_email, '')) = ''
        )
      )
      AND (
        coalesce(f.j ->> 'landingUrlContains', '') = ''
        OR (
          d.lead_id IS NOT NULL
          AND lower(coalesce(d.landing_url, '')) LIKE '%' || lower(btrim(f.j ->> 'landingUrlContains')) || '%'
        )
      )
      AND (
        coalesce(f.j ->> 'surveyRating', 'all') = 'all'
        OR (
          coalesce(f.j ->> 'surveyRating', 'all') = 'none'
          AND d.conv_id IS NOT NULL
          AND d.latest_survey_rating IS NULL
        )
        OR (
          d.conv_id IS NOT NULL
          AND d.latest_survey_rating IS NOT NULL
          AND d.latest_survey_rating::text = btrim(f.j ->> 'surveyRating')
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
      AND (
        coalesce(f.j ->> 'leadMagnetCampaign', 'all') = 'all'
        OR coalesce(d.lead_magnet_campaign_name, '') = btrim(f.j ->> 'leadMagnetCampaign')
      )
      AND (
        coalesce(f.j ->> 'leadMagnetTargetMarket', 'all') = 'all'
        OR coalesce(d.lead_magnet_target_market, '') = btrim(f.j ->> 'leadMagnetTargetMarket')
      )
  ),
  keyed AS (
    SELECT
      d.*,
      CASE lower(
        CASE
          WHEN lower(btrim(coalesce(f.j ->> 'sortColumn', ''))) IN (
            'created_at', 'ticket_id', 'client', 'title', 'services', 'category', 'created_by_name', 'source',
            'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'landing_url', 'attribution_label', 'gclid',
            'assignee', 'followup', 'fu_priority', 'status', 'survey_rating'
          )
          THEN lower(btrim(f.j ->> 'sortColumn'))
          ELSE 'client'
        END
      )
        WHEN 'created_at' THEN to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')
        WHEN 'followup' THEN lpad(coalesce(d.followup::text, ''), 10, '0')
        WHEN 'ticket_id' THEN lower(coalesce(d.ticket_id, ''))
        WHEN 'client' THEN lower(coalesce(d.client, ''))
        WHEN 'title' THEN lower(coalesce(d.title, ''))
        WHEN 'services' THEN lower(coalesce(d.services, ''))
        WHEN 'category' THEN lower(coalesce(d.category, ''))
        WHEN 'created_by_name' THEN lower(coalesce(d.created_by_name, ''))
        WHEN 'source' THEN lower(coalesce(d.source, ''))
        WHEN 'utm_source' THEN lower(coalesce(d.utm_source, ''))
        WHEN 'utm_campaign' THEN lower(coalesce(d.utm_campaign, ''))
        WHEN 'utm_medium' THEN lower(coalesce(d.utm_medium, ''))
        WHEN 'utm_content' THEN lower(coalesce(d.utm_content, ''))
        WHEN 'utm_term' THEN lower(coalesce(d.utm_term, ''))
        WHEN 'landing_url' THEN lower(coalesce(d.landing_url, ''))
        WHEN 'attribution_label' THEN lower(coalesce(d.attribution_label, ''))
        WHEN 'gclid' THEN lower(coalesce(d.gclid, ''))
        WHEN 'assignee' THEN lower(coalesce(d.eff_assignee_label, ''))
        WHEN 'fu_priority' THEN lower(coalesce(d.fu_priority, ''))
        WHEN 'status' THEN lower(coalesce(d.eff_status_name, ''))
        WHEN 'survey_rating' THEN CASE WHEN d.latest_survey_rating IS NULL THEN NULL ELSE lpad(d.latest_survey_rating::text, 2, '0') END
        ELSE lower(coalesce(d.client, ''))
      END AS sort_key
    FROM filtered d
    CROSS JOIN f
  ),
  paged AS (
    SELECT
      row_number() OVER (
        ORDER BY
          CASE
            WHEN lower(btrim(coalesce(f.j ->> 'sortDir', 'asc'))) = 'desc'
              THEN keyed.sort_key
          END DESC NULLS LAST,
          CASE
            WHEN lower(btrim(coalesce(f.j ->> 'sortDir', 'asc'))) <> 'desc'
              THEN keyed.sort_key
          END ASC NULLS LAST,
          keyed.row_id ASC
      ) AS rn,
      keyed.*
    FROM keyed
    CROSS JOIN f
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
            'gclid', nullif(btrim(p.gclid), ''),
            'email', nullif(btrim(p.display_email), ''),
            '_display_email', nullif(btrim(p.display_email), ''),
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
            '_lead_id', p.lead_id,
            'latest_survey_rating', p.latest_survey_rating,
            'latest_survey_comment', p.latest_survey_comment,
            'lead_magnet_campaign_name', p.lead_magnet_campaign_name,
            'lead_magnet_target_market', p.lead_magnet_target_market
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
    ),
    'gclids',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.gclid, '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.gclid), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'service_names',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(nullif(l.services, '')) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND nullif(btrim(l.services), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'sources',
    (
      SELECT coalesce(jsonb_agg(u.x ORDER BY u.x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(l.source) AS x
        FROM public.leads l
        WHERE l.organization_id = p_organization_id
          AND btrim(coalesce(l.source, '')) <> ''
        UNION
        SELECT 'WhatsApp'::text AS x
        WHERE EXISTS (
          SELECT 1
          FROM public.whatsapp_conversations c
          WHERE c.organization_id = p_organization_id
            AND lower(coalesce(c.channel, 'whatsapp')) <> 'instagram'
        )
      ) u
    ),
    'lead_magnet_campaign_names',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(s.lead_magnet_campaign_name) AS x
        FROM public.lead_submissions s
        WHERE s.organization_id = p_organization_id
          AND s.is_active = true
          AND nullif(btrim(s.lead_magnet_campaign_name), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    ),
    'lead_magnet_target_markets',
    (
      SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      FROM (
        SELECT DISTINCT btrim(s.lead_magnet_target_market) AS x
        FROM public.lead_submissions s
        WHERE s.organization_id = p_organization_id
          AND s.is_active = true
          AND nullif(btrim(s.lead_magnet_target_market), '') IS NOT NULL
        ORDER BY x
        LIMIT 500
      ) s
    )
  );
END;
$$;

COMMENT ON FUNCTION public.recipient_picker_filter_options(uuid) IS
  'Distinct filter option values for recipient picker (org owner only), including Lead Magnet campaign/target market.';


