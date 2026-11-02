-- Mencatat perubahan yang sudah ada di database live.
-- Definisi fungsi disalin dari pg_get_functiondef.
-- Grant pembungkus: authenticated dan service_role. Grant __impl: service_role.
-- PUBLIC, anon, dan (pada __impl) authenticated tidak punya EXECUTE.
-- Pemilik postgres tetap punya EXECUTE dan tidak di-GRANT ulang.
-- Bagian akhir: ops_private.auth_revoke_backup, urut sig.
-- Sudah ditandai applied di schema_migrations pada 2 November 2026 (version 20261102150000).

CREATE OR REPLACE FUNCTION public.ensure_livechat_lead_statuses_for_org__impl(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_unread boolean;
  v_max_sort integer;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('open', 'unread')
  ) INTO v_has_unread;

  IF NOT v_has_unread THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Open',
      'New inbound conversation',
      '#6B7280',
      TRUE,
      1,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('in progress', 'on going', 'ongoing', 'in-progress')
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'In Progress',
      'Agent has replied; conversation is active',
      '#F59E0B',
      TRUE,
      2,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) = 'converted'
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Converted',
      'Lead converted to sale',
      '#10B981',
      TRUE,
      3,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) = 'qualified'
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Qualified',
      'Qualified prospect',
      '#3B82F6',
      TRUE,
      4,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('closed', 'resolve')
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Closed',
      'Conversation resolved (Resolve in UI)',
      '#6B7280',
      TRUE,
      5,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_livechat_lead_statuses_for_org(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 PERFORM public.ensure_livechat_lead_statuses_for_org__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.ensure_open_omnichannel_conversation_cycle__impl(p_organization_id uuid, p_conversation_id uuid, p_channel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ch text := public.normalize_sla_channel(p_channel);
BEGIN
  IF v_ch = 'whatsapp' THEN PERFORM public.ensure_open_whatsapp_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'instagram' THEN PERFORM public.ensure_open_instagram_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'facebook' THEN PERFORM public.ensure_open_facebook_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'threads' THEN PERFORM public.ensure_open_threads_dm_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'email' THEN PERFORM public.ensure_open_email_conversation_cycle(p_organization_id, p_conversation_id);
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.ensure_open_omnichannel_conversation_cycle(p_organization_id uuid, p_conversation_id uuid, p_channel text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 PERFORM public.ensure_open_omnichannel_conversation_cycle__impl(p_organization_id, p_conversation_id, p_channel); END; $function$;

CREATE OR REPLACE FUNCTION public.get_crm_first_response_time_per_room__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, customer_display text, assignee_name text, assignee_id uuid, crm_assignee_segment text, channel text, sla_first_reply_status text, sla_first_reply_late_minutes integer, sla_resolution_status text, sla_resolution_late_minutes integer, sla_inter_reply_status text, sla_inter_reply_late_minutes integer, cycle_started_at timestamp with time zone, assignment_due_at timestamp with time zone, resolution_due_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH wa_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_wa_id), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      pol.fr_min,
      pol.res_min,
      pol.ir_min,
      pol.prof,
      pol.ws_tz,
      pol.ws_rules,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'at', to_jsonb(m.created_at),
            'dir', to_jsonb(m.direction)
          )
          ORDER BY m.created_at
        )
        FROM public.whatsapp_messages m
        WHERE m.conversation_id = c.id
          AND m.created_at >= cy.cycle_started_at
          AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
      ) AS msg_json
    FROM public.whatsapp_conversation_cycles cy
    INNER JOIN public.whatsapp_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(
      p_organization_id,
      coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')
    ) pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  wa_calc AS (
    SELECT
      w.*,
      CASE
        WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
        WHEN w.prof = '24x7' OR w.prof IS NULL THEN
          w.first_assignee_in_cycle_at + make_interval(mins => w.fr_min)
        ELSE public.sla_add_working_minutes(
          w.first_assignee_in_cycle_at, w.fr_min, w.prof, w.ws_tz, w.ws_rules
        )
      END AS fr_due,
      CASE
        WHEN w.first_response_at IS NULL THEN NULL::timestamptz
        WHEN w.prof = '24x7' OR w.prof IS NULL THEN
          w.first_response_at + make_interval(mins => w.res_min)
        ELSE public.sla_add_working_minutes(
          w.first_response_at, w.res_min, w.prof, w.ws_tz, w.ws_rules
        )
      END AS res_due
    FROM wa_rows w
  ),
  wa_ir AS (
    SELECT
      c.*,
      ir.ir_status AS ir_status,
      ir.ir_late AS ir_late
    FROM wa_calc c
    LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
      c.ir_min,
      c.prof,
      c.ws_tz,
      c.ws_rules,
      c.first_response_at,
      c.resolved_at,
      c.msg_json
    ) ir ON true
  ),
  wa_final AS (
    SELECT
      w.conversation_id,
      w.customer_display,
      w.assignee_name,
      w.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, w.assignee_id) AS crm_assignee_segment,
      w.channel,
      w.cycle_started_at,
      w.first_response_at,
      w.resolved_at,
      CASE WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE w.fr_due END AS assignment_due_at,
      w.res_due AS resolution_due_at,
      CASE
        WHEN w.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
        WHEN w.first_response_at IS NOT NULL AND w.first_response_at <= w.fr_due THEN 'on_time'::text
        WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN 'late'::text
        WHEN w.first_response_at IS NULL AND now() <= w.fr_due THEN 'pending'::text
        WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_first_reply_status,
      CASE
        WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::integer
        WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              w.fr_due, w.first_response_at, w.prof, w.ws_tz, w.ws_rules
            )
          )
        WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(w.fr_due, now(), w.prof, w.ws_tz, w.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_first_reply_late_minutes,
      CASE
        WHEN w.first_response_at IS NULL THEN 'pending'::text
        WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at <= w.res_due THEN 'on_time'::text
        WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN 'late'::text
        WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() <= w.res_due THEN 'pending'::text
        WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_resolution_status,
      CASE
        WHEN w.first_response_at IS NULL THEN NULL::integer
        WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              w.res_due, w.resolved_at, w.prof, w.ws_tz, w.ws_rules
            )
          )
        WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(w.res_due, now(), w.prof, w.ws_tz, w.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_resolution_late_minutes,
      coalesce(w.ir_status, 'na'::text) AS sla_inter_reply_status,
      w.ir_late AS sla_inter_reply_late_minutes
    FROM wa_ir w
  ),
  ig_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_ig_id), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      'instagram'::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      pol.fr_min,
      pol.res_min,
      pol.ir_min,
      pol.prof,
      pol.ws_tz,
      pol.ws_rules,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'at', to_jsonb(m.created_at),
            'dir', to_jsonb(m.direction)
          )
          ORDER BY m.created_at
        )
        FROM public.instagram_messages m
        WHERE m.conversation_id = c.id
          AND m.created_at >= cy.cycle_started_at
          AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
      ) AS msg_json
    FROM public.instagram_conversation_cycles cy
    INNER JOIN public.instagram_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'instagram') pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  ig_calc AS (
    SELECT
      g.*,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
        WHEN g.prof = '24x7' OR g.prof IS NULL THEN
          g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)
        ELSE public.sla_add_working_minutes(
          g.first_assignee_in_cycle_at, g.fr_min, g.prof, g.ws_tz, g.ws_rules
        )
      END AS fr_due,
      CASE
        WHEN g.first_response_at IS NULL THEN NULL::timestamptz
        WHEN g.prof = '24x7' OR g.prof IS NULL THEN
          g.first_response_at + make_interval(mins => g.res_min)
        ELSE public.sla_add_working_minutes(
          g.first_response_at, g.res_min, g.prof, g.ws_tz, g.ws_rules
        )
      END AS res_due
    FROM ig_rows g
  ),
  ig_ir AS (
    SELECT
      c.*,
      ir.ir_status AS ir_status,
      ir.ir_late AS ir_late
    FROM ig_calc c
    LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
      c.ir_min,
      c.prof,
      c.ws_tz,
      c.ws_rules,
      c.first_response_at,
      c.resolved_at,
      c.msg_json
    ) ir ON true
  ),
  ig_final AS (
    SELECT
      g.conversation_id,
      g.customer_display,
      g.assignee_name,
      g.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, g.assignee_id) AS crm_assignee_segment,
      g.channel,
      g.cycle_started_at,
      g.first_response_at,
      g.resolved_at,
      CASE WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE g.fr_due END AS assignment_due_at,
      g.res_due AS resolution_due_at,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at <= g.fr_due THEN 'on_time'::text
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN 'late'::text
        WHEN g.first_response_at IS NULL AND now() <= g.fr_due THEN 'pending'::text
        WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_first_reply_status,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::integer
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              g.fr_due, g.first_response_at, g.prof, g.ws_tz, g.ws_rules
            )
          )
        WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(g.fr_due, now(), g.prof, g.ws_tz, g.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_first_reply_late_minutes,
      CASE
        WHEN g.first_response_at IS NULL THEN 'pending'::text
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at <= g.res_due THEN 'on_time'::text
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN 'late'::text
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() <= g.res_due THEN 'pending'::text
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_resolution_status,
      CASE
        WHEN g.first_response_at IS NULL THEN NULL::integer
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              g.res_due, g.resolved_at, g.prof, g.ws_tz, g.ws_rules
            )
          )
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(g.res_due, now(), g.prof, g.ws_tz, g.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_resolution_late_minutes,
      coalesce(g.ir_status, 'na'::text) AS sla_inter_reply_status,
      g.ir_late AS sla_inter_reply_late_minutes
    FROM ig_ir g
  ),
  fb_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_psid), ''), nullif(trim(c.customer_external_id), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      'facebook'::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      pol.fr_min,
      pol.res_min,
      pol.ir_min,
      pol.prof,
      pol.ws_tz,
      pol.ws_rules,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'at', to_jsonb(m.created_at),
            'dir', to_jsonb(m.direction)
          )
          ORDER BY m.created_at
        )
        FROM public.facebook_messages m
        WHERE m.conversation_id = c.id
          AND m.created_at >= cy.cycle_started_at
          AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
      ) AS msg_json
    FROM public.facebook_conversation_cycles cy
    INNER JOIN public.facebook_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'facebook') pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  fb_calc AS (
    SELECT
      g.*,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
        WHEN g.prof = '24x7' OR g.prof IS NULL THEN
          g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)
        ELSE public.sla_add_working_minutes(
          g.first_assignee_in_cycle_at, g.fr_min, g.prof, g.ws_tz, g.ws_rules
        )
      END AS fr_due,
      CASE
        WHEN g.first_response_at IS NULL THEN NULL::timestamptz
        WHEN g.prof = '24x7' OR g.prof IS NULL THEN
          g.first_response_at + make_interval(mins => g.res_min)
        ELSE public.sla_add_working_minutes(
          g.first_response_at, g.res_min, g.prof, g.ws_tz, g.ws_rules
        )
      END AS res_due
    FROM fb_rows g
  ),
  fb_ir AS (
    SELECT
      c.*,
      ir.ir_status AS ir_status,
      ir.ir_late AS ir_late
    FROM fb_calc c
    LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
      c.ir_min,
      c.prof,
      c.ws_tz,
      c.ws_rules,
      c.first_response_at,
      c.resolved_at,
      c.msg_json
    ) ir ON true
  ),
  fb_final AS (
    SELECT
      g.conversation_id,
      g.customer_display,
      g.assignee_name,
      g.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, g.assignee_id) AS crm_assignee_segment,
      g.channel,
      g.cycle_started_at,
      g.first_response_at,
      g.resolved_at,
      CASE WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE g.fr_due END AS assignment_due_at,
      g.res_due AS resolution_due_at,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at <= g.fr_due THEN 'on_time'::text
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN 'late'::text
        WHEN g.first_response_at IS NULL AND now() <= g.fr_due THEN 'pending'::text
        WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_first_reply_status,
      CASE
        WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::integer
        WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              g.fr_due, g.first_response_at, g.prof, g.ws_tz, g.ws_rules
            )
          )
        WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(g.fr_due, now(), g.prof, g.ws_tz, g.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_first_reply_late_minutes,
      CASE
        WHEN g.first_response_at IS NULL THEN 'pending'::text
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at <= g.res_due THEN 'on_time'::text
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN 'late'::text
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() <= g.res_due THEN 'pending'::text
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_resolution_status,
      CASE
        WHEN g.first_response_at IS NULL THEN NULL::integer
        WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              g.res_due, g.resolved_at, g.prof, g.ws_tz, g.ws_rules
            )
          )
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(g.res_due, now(), g.prof, g.ws_tz, g.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_resolution_late_minutes,
      coalesce(g.ir_status, 'na'::text) AS sla_inter_reply_status,
      g.ir_late AS sla_inter_reply_late_minutes
    FROM fb_ir g
  ),
  em_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.from_email), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      'email'::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      pol.fr_min,
      pol.res_min,
      pol.ir_min,
      pol.prof,
      pol.ws_tz,
      pol.ws_rules,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'at', to_jsonb(m.created_at),
            'dir', to_jsonb(m.direction)
          )
          ORDER BY m.created_at
        )
        FROM public.email_messages m
        WHERE m.conversation_id = c.id
          AND m.created_at >= cy.cycle_started_at
          AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
      ) AS msg_json
    FROM public.email_conversation_cycles cy
    INNER JOIN public.email_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'email') pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  em_calc AS (
    SELECT
      m.*,
      CASE
        WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
        WHEN m.prof = '24x7' OR m.prof IS NULL THEN
          m.first_assignee_in_cycle_at + make_interval(mins => m.fr_min)
        ELSE public.sla_add_working_minutes(
          m.first_assignee_in_cycle_at, m.fr_min, m.prof, m.ws_tz, m.ws_rules
        )
      END AS fr_due,
      CASE
        WHEN m.first_response_at IS NULL THEN NULL::timestamptz
        WHEN m.prof = '24x7' OR m.prof IS NULL THEN
          m.first_response_at + make_interval(mins => m.res_min)
        ELSE public.sla_add_working_minutes(
          m.first_response_at, m.res_min, m.prof, m.ws_tz, m.ws_rules
        )
      END AS res_due
    FROM em_rows m
  ),
  em_ir AS (
    SELECT
      c.*,
      ir.ir_status AS ir_status,
      ir.ir_late AS ir_late
    FROM em_calc c
    LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
      c.ir_min,
      c.prof,
      c.ws_tz,
      c.ws_rules,
      c.first_response_at,
      c.resolved_at,
      c.msg_json
    ) ir ON true
  ),
  em_final AS (
    SELECT
      m.conversation_id,
      m.customer_display,
      m.assignee_name,
      m.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, m.assignee_id) AS crm_assignee_segment,
      m.channel,
      m.cycle_started_at,
      m.first_response_at,
      m.resolved_at,
      CASE WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE m.fr_due END AS assignment_due_at,
      m.res_due AS resolution_due_at,
      CASE
        WHEN m.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
        WHEN m.first_response_at IS NOT NULL AND m.first_response_at <= m.fr_due THEN 'on_time'::text
        WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN 'late'::text
        WHEN m.first_response_at IS NULL AND now() <= m.fr_due THEN 'pending'::text
        WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_first_reply_status,
      CASE
        WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::integer
        WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              m.fr_due, m.first_response_at, m.prof, m.ws_tz, m.ws_rules
            )
          )
        WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(m.fr_due, now(), m.prof, m.ws_tz, m.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_first_reply_late_minutes,
      CASE
        WHEN m.first_response_at IS NULL THEN 'pending'::text
        WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at <= m.res_due THEN 'on_time'::text
        WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN 'late'::text
        WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() <= m.res_due THEN 'pending'::text
        WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_resolution_status,
      CASE
        WHEN m.first_response_at IS NULL THEN NULL::integer
        WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(
              m.res_due, m.resolved_at, m.prof, m.ws_tz, m.ws_rules
            )
          )
        WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN
          greatest(
            0,
            public.sla_working_minutes_between(m.res_due, now(), m.prof, m.ws_tz, m.ws_rules)
          )
        ELSE NULL::integer
      END AS sla_resolution_late_minutes,
      coalesce(m.ir_status, 'na'::text) AS sla_inter_reply_status,
      m.ir_late AS sla_inter_reply_late_minutes
    FROM em_ir m
  )
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM wa_final f
  UNION ALL
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM ig_final f
  UNION ALL
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM fb_final f
  UNION ALL
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM em_final f;
$function$;

CREATE OR REPLACE FUNCTION public.get_crm_first_response_time_per_room(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, customer_display text, assignee_name text, assignee_id uuid, crm_assignee_segment text, channel text, sla_first_reply_status text, sla_first_reply_late_minutes integer, sla_resolution_status text, sla_resolution_late_minutes integer, sla_inter_reply_status text, sla_inter_reply_late_minutes integer, cycle_started_at timestamp with time zone, assignment_due_at timestamp with time zone, resolution_due_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_crm_first_response_time_per_room__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.get_crm_sla_for_conversation__impl(p_organization_id uuid, p_conversation_id uuid, p_channel text)
 RETURNS TABLE(conversation_id uuid, assignment_due_at timestamp with time zone, resolution_due_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone, sla_first_reply_status text, sla_first_reply_late_minutes integer, sla_resolution_status text, sla_resolution_late_minutes integer, sla_inter_reply_status text, sla_inter_reply_late_minutes integer, first_response_sla_minutes integer, resolution_sla_minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ch text := public.normalize_sla_channel(p_channel);
BEGIN
  PERFORM public.ensure_open_omnichannel_conversation_cycle(
    p_organization_id,
    p_conversation_id,
    v_ch
  );

  IF v_ch = 'whatsapp' THEN
    RETURN QUERY
    WITH wa_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.whatsapp_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.whatsapp_conversation_cycles cy
      INNER JOIN public.whatsapp_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(
        p_organization_id,
        coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')
      ) pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    wa_calc AS (
      SELECT
        w.*,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN w.prof = '24x7' OR w.prof IS NULL THEN
            w.first_assignee_in_cycle_at + make_interval(mins => w.fr_min)
          ELSE public.sla_add_working_minutes(
            w.first_assignee_in_cycle_at, w.fr_min, w.prof, w.ws_tz, w.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN w.first_response_at IS NULL THEN NULL::timestamptz
          WHEN w.prof = '24x7' OR w.prof IS NULL THEN
            w.first_response_at + make_interval(mins => w.res_min)
          ELSE public.sla_add_working_minutes(
            w.first_response_at, w.res_min, w.prof, w.ws_tz, w.ws_rules
          )
        END AS res_due
      FROM wa_rows w
    ),
    wa_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM wa_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    wa_final AS (
      SELECT
        w.conversation_id,
        w.first_response_at,
        w.resolved_at,
        CASE WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE w.fr_due END AS assignment_due_at,
        w.res_due AS resolution_due_at,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at <= w.fr_due THEN 'on_time'::text
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN 'late'::text
          WHEN w.first_response_at IS NULL AND now() <= w.fr_due THEN 'pending'::text
          WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                w.fr_due, w.first_response_at, w.prof, w.ws_tz, w.ws_rules
              )
            )
          WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(w.fr_due, now(), w.prof, w.ws_tz, w.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN w.first_response_at IS NULL THEN 'pending'::text
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at <= w.res_due THEN 'on_time'::text
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN 'late'::text
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() <= w.res_due THEN 'pending'::text
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN w.first_response_at IS NULL THEN NULL::integer
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                w.res_due, w.resolved_at, w.prof, w.ws_tz, w.ws_rules
              )
            )
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(w.res_due, now(), w.prof, w.ws_tz, w.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(w.ir_status, 'na'::text) AS sla_inter_reply_status,
        w.ir_late AS sla_inter_reply_late_minutes,
        w.fr_min AS first_response_sla_minutes,
        w.res_min AS resolution_sla_minutes
      FROM wa_ir w
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM wa_final wf;

  ELSIF v_ch = 'instagram' THEN
    RETURN QUERY
    WITH ig_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.instagram_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.instagram_conversation_cycles cy
      INNER JOIN public.instagram_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(
        p_organization_id,
        'instagram'
      ) pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    ig_calc AS (
      SELECT
        g.*,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)
          ELSE public.sla_add_working_minutes(
            g.first_assignee_in_cycle_at, g.fr_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_response_at + make_interval(mins => g.res_min)
          ELSE public.sla_add_working_minutes(
            g.first_response_at, g.res_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS res_due
      FROM ig_rows g
    ),
    ig_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM ig_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    ig_final AS (
      SELECT
        g.conversation_id,
        g.first_response_at,
        g.resolved_at,
        CASE WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE g.fr_due END AS assignment_due_at,
        g.res_due AS resolution_due_at,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at <= g.fr_due THEN 'on_time'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN 'late'::text
          WHEN g.first_response_at IS NULL AND now() <= g.fr_due THEN 'pending'::text
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.fr_due, g.first_response_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.fr_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN g.first_response_at IS NULL THEN 'pending'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at <= g.res_due THEN 'on_time'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN 'late'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() <= g.res_due THEN 'pending'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::integer
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.res_due, g.resolved_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.res_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(g.ir_status, 'na'::text) AS sla_inter_reply_status,
        g.ir_late AS sla_inter_reply_late_minutes,
        g.fr_min AS first_response_sla_minutes,
        g.res_min AS resolution_sla_minutes
      FROM ig_ir g
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM ig_final wf;

  ELSIF v_ch = 'facebook' THEN
    RETURN QUERY
    WITH fb_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.facebook_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.facebook_conversation_cycles cy
      INNER JOIN public.facebook_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(
        p_organization_id,
        'facebook'
      ) pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    fb_calc AS (
      SELECT
        g.*,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)
          ELSE public.sla_add_working_minutes(
            g.first_assignee_in_cycle_at, g.fr_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_response_at + make_interval(mins => g.res_min)
          ELSE public.sla_add_working_minutes(
            g.first_response_at, g.res_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS res_due
      FROM fb_rows g
    ),
    fb_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM fb_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    fb_final AS (
      SELECT
        g.conversation_id,
        g.first_response_at,
        g.resolved_at,
        CASE WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE g.fr_due END AS assignment_due_at,
        g.res_due AS resolution_due_at,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at <= g.fr_due THEN 'on_time'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN 'late'::text
          WHEN g.first_response_at IS NULL AND now() <= g.fr_due THEN 'pending'::text
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.fr_due, g.first_response_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.fr_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN g.first_response_at IS NULL THEN 'pending'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at <= g.res_due THEN 'on_time'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN 'late'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() <= g.res_due THEN 'pending'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::integer
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.res_due, g.resolved_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.res_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(g.ir_status, 'na'::text) AS sla_inter_reply_status,
        g.ir_late AS sla_inter_reply_late_minutes,
        g.fr_min AS first_response_sla_minutes,
        g.res_min AS resolution_sla_minutes
      FROM fb_ir g
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM fb_final wf;

  ELSIF v_ch = 'email' THEN
    RETURN QUERY
    WITH em_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.email_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.email_conversation_cycles cy
      INNER JOIN public.email_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'email') pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    em_calc AS (
      SELECT
        m.*,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN m.prof = '24x7' OR m.prof IS NULL THEN
            m.first_assignee_in_cycle_at + make_interval(mins => m.fr_min)
          ELSE public.sla_add_working_minutes(
            m.first_assignee_in_cycle_at, m.fr_min, m.prof, m.ws_tz, m.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN m.first_response_at IS NULL THEN NULL::timestamptz
          WHEN m.prof = '24x7' OR m.prof IS NULL THEN
            m.first_response_at + make_interval(mins => m.res_min)
          ELSE public.sla_add_working_minutes(
            m.first_response_at, m.res_min, m.prof, m.ws_tz, m.ws_rules
          )
        END AS res_due
      FROM em_rows m
    ),
    em_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM em_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    em_final AS (
      SELECT
        m.conversation_id,
        m.first_response_at,
        m.resolved_at,
        CASE WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE m.fr_due END AS assignment_due_at,
        m.res_due AS resolution_due_at,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at <= m.fr_due THEN 'on_time'::text
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN 'late'::text
          WHEN m.first_response_at IS NULL AND now() <= m.fr_due THEN 'pending'::text
          WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                m.fr_due, m.first_response_at, m.prof, m.ws_tz, m.ws_rules
              )
            )
          WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(m.fr_due, now(), m.prof, m.ws_tz, m.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN m.first_response_at IS NULL THEN 'pending'::text
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at <= m.res_due THEN 'on_time'::text
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN 'late'::text
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() <= m.res_due THEN 'pending'::text
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN m.first_response_at IS NULL THEN NULL::integer
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                m.res_due, m.resolved_at, m.prof, m.ws_tz, m.ws_rules
              )
            )
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(m.res_due, now(), m.prof, m.ws_tz, m.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(m.ir_status, 'na'::text) AS sla_inter_reply_status,
        m.ir_late AS sla_inter_reply_late_minutes,
        m.fr_min AS first_response_sla_minutes,
        m.res_min AS resolution_sla_minutes
      FROM em_ir m
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM em_final wf;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_crm_sla_for_conversation(p_organization_id uuid, p_conversation_id uuid, p_channel text)
 RETURNS TABLE(conversation_id uuid, assignment_due_at timestamp with time zone, resolution_due_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone, sla_first_reply_status text, sla_first_reply_late_minutes integer, sla_resolution_status text, sla_resolution_late_minutes integer, sla_inter_reply_status text, sla_inter_reply_late_minutes integer, first_response_sla_minutes integer, resolution_sla_minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_crm_sla_for_conversation__impl(p_organization_id, p_conversation_id, p_channel); END; $function$;

CREATE OR REPLACE FUNCTION public.get_department_objectives_with_key_results__impl(p_organization_id uuid, p_cycle_ids uuid[] DEFAULT NULL::uuid[], p_include_individual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH depts AS (
    SELECT
      dbo.id,
      dbo.organization_id,
      dbo.cycle_id,
      dbo.company_objective_id,
      dbo.department_id,
      dbo.title,
      dbo.description,
      dbo.status,
      dbo.progress_percentage,
      dbo.weight,
      dbo.start_date,
      dbo.end_date,
      dbo.owner_id,
      dbo.created_by,
      dbo.created_at,
      dbo.updated_at,
      d.name AS dept_name,
      co.title AS co_title,
      oc.name AS oc_name,
      oc.year AS oc_year,
      oc.quarter AS oc_quarter
    FROM department_objectives dbo
    INNER JOIN departments d ON d.id = dbo.department_id
    INNER JOIN company_objectives co ON co.id = dbo.company_objective_id
    INNER JOIN okr_cycles oc ON oc.id = dbo.cycle_id
    WHERE dbo.organization_id = p_organization_id
      AND (
        p_cycle_ids IS NULL
        OR cardinality(p_cycle_ids) = 0
        OR dbo.cycle_id = ANY(p_cycle_ids)
      )
    ORDER BY dbo.created_at DESC
  ),
  krs AS (
    SELECT
      kr.department_objective_id,
      jsonb_agg(
        jsonb_build_object(
          'id', kr.id,
          'title', kr.title,
          'target_value', kr.target_value,
          'current_value', kr.current_value,
          'unit', kr.unit,
          'metric_type', kr.metric_type,
          'progress_percentage', kr.progress_percentage,
          'weight', kr.weight,
          'department_objective_id', kr.department_objective_id,
          'company_objective_id', kr.company_objective_id
        )
      ) FILTER (WHERE kr.id IS NOT NULL) AS key_results_json
    FROM key_results kr
    INNER JOIN depts dbo ON dbo.id = kr.department_objective_id
    WHERE kr.company_objective_id IS NULL
      AND trim(lower(COALESCE(kr.title, ''))) IS DISTINCT FROM trim(lower(COALESCE(dbo.title, '')))
    GROUP BY kr.department_objective_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'organization_id', d.organization_id,
      'cycle_id', d.cycle_id,
      'company_objective_id', d.company_objective_id,
      'department_id', d.department_id,
      'title', d.title,
      'description', d.description,
      'status', d.status,
      'progress_percentage', d.progress_percentage,
      'weight', d.weight,
      'start_date', d.start_date,
      'end_date', d.end_date,
      'owner_id', d.owner_id,
      'created_by', d.created_by,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'departments', jsonb_build_object('name', d.dept_name),
      'company_objectives', jsonb_build_object('title', d.co_title),
      'okr_cycles', jsonb_build_object('name', d.oc_name, 'year', d.oc_year, 'quarter', d.oc_quarter),
      'key_results', (
        SELECT COALESCE(k.key_results_json, '[]'::jsonb)
        FROM krs k
        WHERE k.department_objective_id = d.id
      )
    )
  )
  INTO result
  FROM depts d;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_department_objectives_with_key_results(p_organization_id uuid, p_cycle_ids uuid[] DEFAULT NULL::uuid[], p_include_individual boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.get_department_objectives_with_key_results__impl(p_organization_id, p_cycle_ids, p_include_individual); END; $function$;

CREATE OR REPLACE FUNCTION public.get_email_unread_counts__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM email_conversations c
  LEFT JOIN email_messages m ON m.conversation_id = c.id AND m.direction = 'inbound' AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id
  HAVING COUNT(m.id) > 0;
$function$;

CREATE OR REPLACE FUNCTION public.get_email_unread_counts(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_email_unread_counts__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.get_facebook_unread_counts__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM public.facebook_conversations c
  LEFT JOIN public.facebook_messages m
    ON m.conversation_id = c.id
    AND m.direction = 'inbound'
    AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_facebook_unread_counts(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_facebook_unread_counts__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.get_instagram_unread_counts__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM public.instagram_conversations c
  LEFT JOIN public.instagram_messages m
    ON m.conversation_id = c.id
    AND m.direction = 'inbound'
    AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_instagram_unread_counts(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_instagram_unread_counts__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_cycle_metrics__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, assignee_id uuid, cycle_started_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone, channel text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    cy.conversation_id,
    c.assignee_id,
    cy.cycle_started_at,
    cy.first_response_at,
    cy.resolved_at,
    COALESCE(NULLIF(lower(trim(c.channel)), ''), 'whatsapp') AS channel
  FROM public.whatsapp_conversation_cycles cy
  JOIN public.whatsapp_conversations c ON c.id = cy.conversation_id
  WHERE c.organization_id = p_organization_id
  UNION ALL
  SELECT
    cy.conversation_id,
    c.assignee_id,
    cy.cycle_started_at,
    cy.first_response_at,
    cy.resolved_at,
    'facebook'::text AS channel
  FROM public.facebook_conversation_cycles cy
  JOIN public.facebook_conversations c ON c.id = cy.conversation_id
  WHERE c.organization_id = p_organization_id
  ORDER BY cycle_started_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_cycle_metrics(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, assignee_id uuid, cycle_started_at timestamp with time zone, first_response_at timestamp with time zone, resolved_at timestamp with time zone, channel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_whatsapp_cycle_metrics__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts__impl(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM whatsapp_conversations c
  LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id AND m.direction = 'inbound' AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(p_organization_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.get_whatsapp_unread_counts__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_connected__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_ads_connections c
    INNER JOIN public.organization_google_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_connected(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_google_ads_connected__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_integration_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_ads_connections c
    INNER JOIN public.organization_google_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_integration_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_google_ads_integration_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_ads_connections c
    INNER JOIN public.organization_google_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_google_ads_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_google_ads_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_google_contacts_connected__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_contacts_connections c
    INNER JOIN public.organization_google_contacts_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_google_contacts_connected(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_google_contacts_connected__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_linkedin_content_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_linkedin_content_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_linkedin_content_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_linkedin_content_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_connected__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_connected(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_meta_ads_connected__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_integration_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_integration_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_meta_ads_integration_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_meta_ads_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_meta_ads_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_connections c
    INNER JOIN public.organization_tiktok_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_tiktok_ads_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_content_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_content_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_content_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_tiktok_content_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_connected__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_connection_tokens t
    WHERE t.organization_id = p_organization_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_connected(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_tiktok_shop_connected__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_integration_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_connections c
    INNER JOIN public.organization_tiktok_shop_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_integration_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_tiktok_shop_integration_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.is_youtube_content_reporting_enabled__impl(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_youtube_content_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_youtube_content_reporting_enabled(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN public.is_youtube_content_reporting_enabled__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.pos_seed_default_payment_channels__impl(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.pos_payment_method_channels (
    organization_id, pos_outlet_id, category, name, slug, legacy_payment_method, sort_order
  )
  SELECT p_organization_id, NULL, v.category, v.name, v.slug, v.legacy_payment_method, v.sort_order
  FROM (
    VALUES
      ('cash', 'Cash', 'cash', 'cash', 10),
      ('qris', 'QRIS', 'qris', 'qris', 15),
      ('e_wallet', 'GOPAY', 'gopay', 'e_wallet', 20),
      ('e_wallet', 'OVO', 'ovo', 'e_wallet', 21),
      ('e_wallet', 'DANA', 'dana', 'e_wallet', 22),
      ('e_wallet', 'ShopeePay', 'shopeepay', 'e_wallet', 23),
      ('edc', 'BCA', 'bca', 'bank_transfer', 30),
      ('edc', 'Mandiri', 'mandiri', 'bank_transfer', 31),
      ('edc', 'Bank Transfer', 'bank-transfer', 'bank_transfer', 32),
      ('e_commerce', 'Tokopedia', 'tokopedia', NULL, 40),
      ('integration', 'Online Order', 'online-order', NULL, 50),
      ('integration', 'GoStore - GoPay', 'gostore-gopay', NULL, 51),
      ('other', 'Other', 'other', NULL, 90)
  ) AS v(category, name, slug, legacy_payment_method, sort_order)
  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_seed_default_payment_channels(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 PERFORM public.pos_seed_default_payment_channels__impl(p_organization_id); END; $function$;

CREATE OR REPLACE FUNCTION public.resolve_effective_schedule__impl(p_employee_id uuid, p_organization_id uuid, p_effective_date date)
 RETURNS TABLE(source text, shift_id uuid, employee_shift_id uuid, work_schedule_id uuid, schedule_name text, start_time text, end_time text, late_tolerance_minutes integer, overtime_threshold_minutes integer, break_duration_minutes integer, timezone text, working_days integer[], is_working_day boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wss public.work_schedule_settings%ROWTYPE;
  v_emp_wss_id uuid;
  v_es_id uuid;
  v_shift_id uuid;
  v_shift_name text;
  v_shift_start text;
  v_shift_end text;
  v_shift_late_tol integer;
  v_shift_break integer;
  v_working_days integer[];
  v_app_dow integer;
  v_is_working boolean;
BEGIN
  SELECT e.work_schedule_id
  INTO v_emp_wss_id
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.organization_id = p_organization_id;

  IF v_emp_wss_id IS NOT NULL THEN
    SELECT wss.*
    INTO v_wss
    FROM public.work_schedule_settings wss
    WHERE wss.id = v_emp_wss_id
      AND wss.organization_id = p_organization_id
      AND COALESCE(wss.is_active, true);
  END IF;

  IF v_wss.id IS NULL THEN
    SELECT wss.*
    INTO v_wss
    FROM public.work_schedule_settings wss
    WHERE wss.organization_id = p_organization_id
      AND COALESCE(wss.is_active, true)
    ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
    LIMIT 1;
  END IF;

  v_working_days := COALESCE(v_wss.working_days, ARRAY[1, 2, 3, 4, 5]);
  v_app_dow := public.pg_dow_to_app_dow(EXTRACT(DOW FROM p_effective_date)::integer);
  v_is_working := v_working_days IS NOT NULL AND v_app_dow = ANY (v_working_days);

  SELECT es.id, es.shift_id, s.name, s.start_time, s.end_time, s.late_tolerance_minutes, s.break_duration_minutes
  INTO v_es_id, v_shift_id, v_shift_name, v_shift_start, v_shift_end, v_shift_late_tol, v_shift_break
  FROM public.employee_shifts es
  INNER JOIN public.shifts s ON s.id = es.shift_id
  WHERE es.employee_id = p_employee_id
    AND es.organization_id = p_organization_id
    AND COALESCE(es.is_active, true)
    AND es.effective_from_date <= p_effective_date
    AND (es.effective_to_date IS NULL OR es.effective_to_date >= p_effective_date)
    AND COALESCE(s.is_active, true)
  ORDER BY es.effective_from_date DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'shift'::text,
      v_shift_id,
      v_es_id,
      v_wss.id,
      COALESCE(v_shift_name, 'Shift'),
      COALESCE(v_shift_start, '08:00'),
      COALESCE(v_shift_end, '17:00'),
      COALESCE(v_shift_late_tol, v_wss.late_tolerance_minutes, 0),
      COALESCE(v_wss.overtime_threshold_minutes, 0),
      COALESCE(v_shift_break, 0),
      COALESCE(v_wss.timezone, 'Asia/Jakarta'),
      v_working_days,
      v_is_working;
    RETURN;
  END IF;

  IF v_wss.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'work_schedule'::text,
    NULL::uuid,
    NULL::uuid,
    v_wss.id,
    COALESCE(v_wss.name, 'Jadwal Kerja'),
    COALESCE(v_wss.start_time, '09:00'),
    COALESCE(v_wss.end_time, '17:00'),
    COALESCE(v_wss.late_tolerance_minutes, 0),
    COALESCE(v_wss.overtime_threshold_minutes, 0),
    0,
    COALESCE(v_wss.timezone, 'Asia/Jakarta'),
    v_working_days,
    v_is_working;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_effective_schedule(p_employee_id uuid, p_organization_id uuid, p_effective_date date)
 RETURNS TABLE(source text, shift_id uuid, employee_shift_id uuid, work_schedule_id uuid, schedule_name text, start_time text, end_time text, late_tolerance_minutes integer, overtime_threshold_minutes integer, break_duration_minutes integer, timezone text, working_days integer[], is_working_day boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN 
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
 RETURN QUERY SELECT * FROM public.resolve_effective_schedule__impl(p_employee_id, p_organization_id, p_effective_date); END; $function$;

-- Grant/REVOKE pasangan __impl dan pembungkus, sesuai keadaan live.

REVOKE EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_omnichannel_conversation_cycle__impl(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_omnichannel_conversation_cycle__impl(uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_omnichannel_conversation_cycle(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_omnichannel_conversation_cycle(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_crm_sla_for_conversation__impl(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_sla_for_conversation__impl(uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_crm_sla_for_conversation(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crm_sla_for_conversation(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_department_objectives_with_key_results__impl(uuid,uuid[],boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_department_objectives_with_key_results__impl(uuid,uuid[],boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_department_objectives_with_key_results(uuid,uuid[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_department_objectives_with_key_results(uuid,uuid[],boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_unread_counts__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_unread_counts__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_unread_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_email_unread_counts(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_facebook_unread_counts__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_facebook_unread_counts__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_facebook_unread_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_facebook_unread_counts(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_instagram_unread_counts__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instagram_unread_counts__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_instagram_unread_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instagram_unread_counts(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_unread_counts__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_google_ads_connected__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_google_ads_connected(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_integration_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_google_ads_integration_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_integration_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_google_ads_integration_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_google_ads_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_ads_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_google_ads_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_contacts_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_google_contacts_connected__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_google_contacts_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_google_contacts_connected(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_linkedin_content_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_linkedin_content_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_linkedin_content_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_linkedin_content_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_connected__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_connected(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_integration_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_integration_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_integration_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_integration_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_meta_ads_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meta_ads_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_ads_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_ads_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_content_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_content_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_content_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_content_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_shop_connected__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_connected__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_shop_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_connected(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_shop_integration_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_integration_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_tiktok_shop_integration_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_integration_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_youtube_content_reporting_enabled__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_youtube_content_reporting_enabled__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_youtube_content_reporting_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_youtube_content_reporting_enabled(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_seed_default_payment_channels__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_seed_default_payment_channels__impl(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_effective_schedule__impl(uuid,uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule__impl(uuid,uuid,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid,uuid,date) TO authenticated, service_role;

-- authenticated dicabut. service_role tetap.
-- Daftar dari ops_private.auth_revoke_backup, urut sig.

REVOKE EXECUTE ON FUNCTION public._apply_catalog_stock_lines(uuid,uuid,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_catalog_stock_lines(uuid,uuid,text,text,jsonb,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public._collect_organization_auth_users_to_delete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._collect_organization_auth_users_to_delete(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._lead_merge_assert_org_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lead_merge_assert_org_access(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._lead_merge_is_attributed(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lead_merge_is_attributed(uuid,uuid,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public._lead_merge_pick_winner(uuid,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lead_merge_pick_winner(uuid,uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public._organization_has_cms_admin_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._organization_has_cms_admin_member(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._plan_modules_json_for_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._plan_modules_json_for_plan(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._preview_organization_key_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._preview_organization_key_counts(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_checkout_totals(uuid,numeric,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_checkout_totals(uuid,numeric,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_ensure_lead(uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_ensure_lead(uuid,uuid,uuid,text,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_fire_kitchen(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_fire_kitchen(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_hours_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_hours_state(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_modifier_option_oos(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_modifier_option_oos(uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_new_claim_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_new_claim_token() TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_org_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_org_actor(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_resolve_outlet(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_resolve_outlet(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_resolve_sales_type(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_resolve_sales_type(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_sanitize_cart(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_sanitize_cart(uuid,uuid,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_session_is_guest_cashier_hold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_session_is_guest_cashier_hold(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_table_state(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_table_state(uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.build_daily_task_deeplink(text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_daily_task_deeplink(text,uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.build_task_step_comment_deeplink(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_task_step_comment_deeplink(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_social_media_scheduled_posts_for_plan(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_social_media_scheduled_posts_for_plan(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_inventory_po_mode(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_inventory_po_mode(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_inventory_transfer_mode(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_inventory_transfer_mode(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_po_actor_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_po_actor_name(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_po_update_avg_cost(uuid,uuid,text,uuid,uuid,uuid,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_po_update_avg_cost(uuid,uuid,text,uuid,uuid,uuid,numeric,numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_actor_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_actor_name(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_ensure_dest_row(uuid,uuid,text,uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_ensure_dest_row(uuid,uuid,text,uuid,uuid,uuid,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_fulfill_line(uuid,uuid,uuid,text,text,record) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_fulfill_line(uuid,uuid,uuid,text,text,record) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_insert_event(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_insert_event(uuid,uuid,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_ship_line(uuid,uuid,uuid,text,text,record) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_ship_line(uuid,uuid,uuid,text,text,record) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_campaign_budget_headroom(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_campaign_budget_headroom(uuid,numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.completion_pending_approval(text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.completion_pending_approval(text,uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.compute_lead_magnet_addon_amount_service(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_lead_magnet_addon_amount_service(uuid,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.count_template_followups_since_reset(uuid,uuid,timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_template_followups_since_reset(uuid,uuid,timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.crm_assignee_segment_for_org(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_assignee_segment_for_org(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.employee_user_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_user_id(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_pos_shift_recap_email(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_pos_shift_recap_email(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_task_step_comment_push(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_task_step_comment_push(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_task_step_comment_reaction_push(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_task_step_comment_reaction_push(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_email_conversation_cycle(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_email_conversation_cycle(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_threads_dm_conversation_cycle(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_dm_conversation_cycle(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.estimate_travel_minutes(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_travel_minutes(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_org_api_system_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_org_api_system_actor(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_social_media_schedule_monitoring_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_media_schedule_monitoring_summary() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_social_media_scheduler_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_media_scheduler_config() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_threads_dm_conversations_with_preview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_threads_dm_conversations_with_preview(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_traffic_dashboard_base_before_first_touch_utm(text,date,date,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard_base_before_first_touch_utm(text,date,date,integer,integer,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_traffic_dashboard_base_before_hybrid_utm(text,date,date,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard_base_before_hybrid_utm(text,date,date,integer,integer,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_role_in_org(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_in_org(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_penalty_exemption(uuid,uuid,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_penalty_exemption(uuid,uuid,date,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_daily_task_assignment_notification(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamp with time zone,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_daily_task_assignment_notification(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamp with time zone,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_daily_task_completion_notification(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,boolean,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_daily_task_completion_notification(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,boolean,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_social_media_production_notification(uuid,uuid,text,uuid,text,uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_social_media_production_notification(uuid,uuid,text,uuid,text,uuid,uuid,uuid,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.latest_review_token_for_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_review_token_for_plan(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.latest_step_assignment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_step_assignment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.latest_substep_assignment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_substep_assignment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.latest_task_assignment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_task_assignment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.lead_status_is_resolved_survey(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_status_is_resolved_survey(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.load_attendance_rules(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_attendance_rules(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.omnichannel_employee_sees_conversation(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnichannel_employee_sees_conversation(uuid,uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.org_can_access_web_id(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_can_access_web_id(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_estimate_line_unit_cogs(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_estimate_line_unit_cogs(uuid,uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_finalize_qris_checkout(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_finalize_qris_checkout(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_shift_cashier_display_name(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_cashier_display_name(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_shift_cashier_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_cashier_display_name(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_shift_expected_cash(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_expected_cash(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_start_shift(uuid,uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_start_shift(uuid,uuid,numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.production_review_url_for_assigner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.production_review_url_for_assigner(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.profile_display_name(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_display_name(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.profile_user_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_user_id(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_attendance_from_client_visit(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_from_client_visit(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,text,boolean,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.recover_stale_publishing_rows(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_publishing_rows(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_budget_allocation_payout(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_budget_allocation_payout(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_assignment_due_date(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_assignment_due_date(text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_attendance_late_for_day(uuid,uuid,date,timestamp without time zone,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_late_for_day(uuid,uuid,date,timestamp without time zone,uuid,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_brick_disbursement_source_bank_account_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_brick_disbursement_source_bank_account_id(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_brick_va_bank_account_id(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_brick_va_bank_account_id(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_daily_task_entity_title(text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_daily_task_entity_title(text,uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_inventory_po_expense_classification(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_inventory_po_expense_classification(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_production_assignee_user_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_production_assignee_user_id(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_production_assigner_user_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_production_assigner_user_id(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_sla_policy_row(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_sla_policy_row(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_visit_day_mode(uuid,uuid,date,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_visit_day_mode(uuid,uuid,date,uuid,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_plan_module_access_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_plan_module_access_defaults(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_sales_module_access_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_sales_module_access_defaults(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.service_get_leads_by_utm_campaign(uuid,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_get_leads_by_utm_campaign(uuid,date,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.service_get_traffic_ingestion_status(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_ingestion_status(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(uuid,text,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(uuid,text,date,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_utm_campaign(uuid,text,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_utm_campaign(uuid,text,date,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sla_add_working_minutes(timestamp with time zone,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sla_add_working_minutes(timestamp with time zone,integer,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sla_inter_reply_worst_in_cycle(integer,text,text,jsonb,timestamp with time zone,timestamp with time zone,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sla_inter_reply_worst_in_cycle(integer,text,text,jsonb,timestamp with time zone,timestamp with time zone,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sla_working_minutes_between(timestamp with time zone,timestamp with time zone,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sla_working_minutes_between(timestamp with time zone,timestamp with time zone,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_catalog_po_purchase_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_catalog_po_purchase_request(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_milestones_from_payment_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_milestones_from_payment_status(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_payment_status_from_milestones(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_payment_status_from_milestones(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_threshold_rows_from_payment_terms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_threshold_rows_from_payment_terms(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.traffic_resolve_query_date_bounds(text,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.traffic_resolve_query_date_bounds(text,date,date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.try_acquire_social_media_publish_slot(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_social_media_publish_slot(uuid,text,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_kol_budget_allocation(uuid,uuid,uuid,numeric,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_kol_budget_allocation(uuid,uuid,uuid,numeric,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_display_name(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_inventory_feature_access(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_inventory_feature_access(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_org_role(uuid,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_role(uuid,text[]) TO service_role;
