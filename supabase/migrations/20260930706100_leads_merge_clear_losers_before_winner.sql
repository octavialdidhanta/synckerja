-- Fix soft-merge: clear loser identity BEFORE coalescing onto winner
-- (avoids leads_guard_pos_checkout_update → pos_checkout_phone_exists).
-- Checkout bridge: prefer phone-anchored lead as winner (POS primary path).

CREATE OR REPLACE FUNCTION public._lead_merge_execute_cluster(
  p_organization_id uuid,
  p_kind text,
  p_cluster_key text,
  p_winner uuid,
  p_losers uuid[],
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_email text;
  v_client text;
BEGIN
  IF p_winner IS NULL OR p_losers IS NULL OR cardinality(p_losers) = 0 THEN
    RETURN;
  END IF;

  p_losers := array(
    SELECT l.id
    FROM public.leads l
    WHERE l.id = ANY (p_losers)
      AND l.organization_id = p_organization_id
      AND l.merged_into_lead_id IS NULL
      AND l.id IS DISTINCT FROM p_winner
  );
  IF cardinality(p_losers) = 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leads w
    WHERE w.id = p_winner
      AND w.organization_id = p_organization_id
      AND w.merged_into_lead_id IS NULL
  ) THEN
    RETURN;
  END IF;

  UPDATE public.sales_activities
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.sales_invoices
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.lead_submissions
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.lead_magnet_enrollments
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.lead_magnet_participant_profiles
  SET canonical_lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND canonical_lead_id = ANY (p_losers);

  UPDATE public.whatsapp_recipient_list_members
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.whatsapp_template_followups
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.clients
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.client_visits
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.pos_pending_checkouts
  SET lead_id = p_winner
  WHERE organization_id = p_organization_id
    AND lead_id = ANY (p_losers);

  UPDATE public.customer_visits cv
  SET lead_id = p_winner
  WHERE cv.organization_id = p_organization_id
    AND cv.lead_id = ANY (p_losers)
    AND NOT (
      lower(cv.status) = 'completed'
      AND cv.match_status = 'matched'
      AND EXISTS (
        SELECT 1
        FROM public.customer_visits w
        WHERE w.organization_id = cv.organization_id
          AND w.lead_id = p_winner
          AND w.visit_date = cv.visit_date
          AND w.match_status = 'matched'
          AND lower(w.status) = 'completed'
      )
    );

  UPDATE public.lead_follow_up_updates
  SET lead_id = p_winner
  WHERE lead_id = ANY (p_losers);

  UPDATE public.lead_status_history
  SET lead_id = p_winner
  WHERE lead_id = ANY (p_losers);

  IF NOT EXISTS (
    SELECT 1 FROM public.google_ads_conversion_uploads g WHERE g.lead_id = p_winner
  ) THEN
    UPDATE public.google_ads_conversion_uploads u
    SET lead_id = p_winner
    WHERE u.id = (
      SELECT g.id
      FROM public.google_ads_conversion_uploads g
      WHERE g.lead_id = ANY (p_losers)
      ORDER BY g.updated_at DESC NULLS LAST
      LIMIT 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.meta_ads_conversion_uploads m WHERE m.lead_id = p_winner
  ) THEN
    UPDATE public.meta_ads_conversion_uploads u
    SET lead_id = p_winner
    WHERE u.id = (
      SELECT g.id
      FROM public.meta_ads_conversion_uploads g
      WHERE g.lead_id = ANY (p_losers)
      ORDER BY g.updated_at DESC NULLS LAST
      LIMIT 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lead_google_contact_links g
    WHERE g.organization_id = p_organization_id
      AND g.lead_id = p_winner
  ) THEN
    UPDATE public.lead_google_contact_links u
    SET lead_id = p_winner
    WHERE u.id = (
      SELECT g.id
      FROM public.lead_google_contact_links g
      WHERE g.organization_id = p_organization_id
        AND g.lead_id = ANY (p_losers)
      ORDER BY g.updated_at DESC NULLS LAST
      LIMIT 1
    );
  END IF;

  UPDATE public.google_contacts_sync_jobs j
  SET lead_id = p_winner
  WHERE j.organization_id = p_organization_id
    AND j.lead_id = ANY (p_losers);

  -- Capture identity from losers, then soft-archive (clear keys) BEFORE winner patch
  -- so unique indexes + leads_guard_pos_checkout_update do not see duplicate phone.
  SELECT
    (SELECT l.phone_number FROM public.leads l
     WHERE l.id = ANY (p_losers)
       AND public.normalize_wa_phone_key(l.phone_number) IS NOT NULL
     ORDER BY l.updated_at DESC NULLS LAST LIMIT 1),
    (SELECT NULLIF(lower(btrim(l.email)), '') FROM public.leads l
     WHERE l.id = ANY (p_losers)
       AND NULLIF(btrim(l.email), '') IS NOT NULL
     ORDER BY l.updated_at DESC NULLS LAST LIMIT 1),
    (SELECT l.client FROM public.leads l
     WHERE l.id = ANY (p_losers)
       AND NOT public.is_generic_customer_name(l.client)
     ORDER BY l.updated_at DESC NULLS LAST LIMIT 1)
  INTO v_phone, v_email, v_client;

  UPDATE public.leads
  SET
    phone_number = NULL,
    email = NULL,
    merged_into_lead_id = p_winner,
    merged_at = now(),
    merged_by = p_actor,
    updated_at = now()
  WHERE id = ANY (p_losers)
    AND organization_id = p_organization_id
    AND merged_into_lead_id IS NULL;

  UPDATE public.leads
  SET
    phone_number = CASE
      WHEN public.normalize_wa_phone_key(phone_number) IS NULL AND v_phone IS NOT NULL
      THEN v_phone
      ELSE phone_number
    END,
    email = CASE
      WHEN NULLIF(btrim(COALESCE(email, '')), '') IS NULL AND v_email IS NOT NULL
      THEN v_email
      ELSE email
    END,
    client = CASE
      WHEN public.is_generic_customer_name(client)
           AND v_client IS NOT NULL
           AND NOT public.is_generic_customer_name(v_client)
      THEN v_client
      ELSE client
    END,
    updated_at = now()
  WHERE id = p_winner;

  INSERT INTO public.lead_merge_events (
    organization_id,
    cluster_kind,
    cluster_key,
    winner_lead_id,
    loser_lead_ids,
    skipped,
    skip_reason,
    created_by
  ) VALUES (
    p_organization_id,
    p_kind,
    p_cluster_key,
    p_winner,
    p_losers,
    false,
    NULL,
    p_actor
  );
END;
$$;

-- Prefer phone-anchored lead as winner unless only the email lead is attributed.
CREATE OR REPLACE FUNCTION public.merge_checkout_identity_bridge_dry_run(
  p_organization_id uuid,
  p_phone_lead_id uuid,
  p_email_lead_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_lead public.leads%ROWTYPE;
  v_email_lead public.leads%ROWTYPE;
  v_phone_key text;
  v_email_key text;
  v_attr_count int;
  v_phone_attr boolean;
  v_email_attr boolean;
  v_winner uuid;
  v_losers uuid[];
  v_cluster_key text;
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  IF p_phone_lead_id IS NULL OR p_email_lead_id IS NULL THEN
    RAISE EXCEPTION 'lead_ids_required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_phone_lead_id = p_email_lead_id THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'skipped', true,
      'skip_reason', 'same_lead',
      'winner_lead_id', p_phone_lead_id,
      'loser_lead_ids', '[]'::jsonb,
      'cluster_key', NULL,
      'merged', false
    );
  END IF;

  SELECT * INTO v_phone_lead
  FROM public.leads
  WHERE id = p_phone_lead_id
    AND organization_id = p_organization_id
    AND merged_into_lead_id IS NULL;

  SELECT * INTO v_email_lead
  FROM public.leads
  WHERE id = p_email_lead_id
    AND organization_id = p_organization_id
    AND merged_into_lead_id IS NULL;

  IF v_phone_lead.id IS NULL OR v_email_lead.id IS NULL THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'skipped', true,
      'skip_reason', 'lead_not_found_or_archived',
      'winner_lead_id', NULL,
      'loser_lead_ids', '[]'::jsonb,
      'cluster_key', NULL,
      'merged', false
    );
  END IF;

  v_phone_key := public.normalize_wa_phone_key(v_phone_lead.phone_number);
  v_email_key := lower(btrim(COALESCE(v_email_lead.email, '')));
  IF v_email_key = '' THEN
    v_email_key := NULL;
  END IF;

  IF v_phone_key IS NULL OR v_email_key IS NULL THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'skipped', true,
      'skip_reason', 'missing_phone_or_email_key',
      'winner_lead_id', NULL,
      'loser_lead_ids', '[]'::jsonb,
      'cluster_key', NULL,
      'merged', false
    );
  END IF;

  IF NOT public._lead_merge_is_valid_identity_email(v_email_key) THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'skipped', true,
      'skip_reason', 'invalid_email',
      'winner_lead_id', NULL,
      'loser_lead_ids', '[]'::jsonb,
      'cluster_key', NULL,
      'merged', false
    );
  END IF;

  SELECT count(*)::int
  INTO v_attr_count
  FROM public.leads l
  WHERE l.id IN (p_phone_lead_id, p_email_lead_id)
    AND public._lead_merge_is_attributed(p_organization_id, l.id, l.source, l.ticket_id);

  v_cluster_key := 'phone:' || v_phone_key || '|email:' || v_email_key;

  IF v_attr_count > 1 THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'skipped', true,
      'skip_reason', 'ambiguous_attributed',
      'winner_lead_id', NULL,
      'loser_lead_ids', '[]'::jsonb,
      'cluster_key', v_cluster_key,
      'merged', false
    );
  END IF;

  v_phone_attr := public._lead_merge_is_attributed(
    p_organization_id, v_phone_lead.id, v_phone_lead.source, v_phone_lead.ticket_id
  );
  v_email_attr := public._lead_merge_is_attributed(
    p_organization_id, v_email_lead.id, v_email_lead.source, v_email_lead.ticket_id
  );

  IF v_email_attr AND NOT v_phone_attr THEN
    v_winner := p_email_lead_id;
  ELSE
    -- Default: phone-anchored lead wins (POS primary identity).
    v_winner := p_phone_lead_id;
  END IF;

  v_losers := ARRAY(
    SELECT x FROM unnest(ARRAY[p_phone_lead_id, p_email_lead_id]) AS x
    WHERE x IS DISTINCT FROM v_winner
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'skipped', false,
    'skip_reason', NULL,
    'winner_lead_id', v_winner,
    'loser_lead_ids', to_jsonb(v_losers),
    'cluster_key', v_cluster_key,
    'phone_lead_id', p_phone_lead_id,
    'email_lead_id', p_email_lead_id,
    'merged', false
  );
END;
$$;

COMMENT ON FUNCTION public._lead_merge_execute_cluster(uuid, text, text, uuid, uuid[], uuid) IS
  'Soft-merge cluster: rebind FKs, archive losers (clear phone/email) first, then fill-empty contacts on winner.';
