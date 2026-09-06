-- Fase 5: checkout identity bridge — soft-merge phone lead ≠ email lead in one ensure call.
-- Reuses _lead_merge_execute_cluster / _lead_merge_assert_org_access / _lead_merge_pick_winner.

ALTER TABLE public.lead_merge_events
  DROP CONSTRAINT IF EXISTS lead_merge_events_cluster_kind_check;

ALTER TABLE public.lead_merge_events
  ADD CONSTRAINT lead_merge_events_cluster_kind_check
  CHECK (cluster_kind IN ('phone', 'email', 'typo_email', 'identity_graph', 'checkout_bridge'));

-- ---------------------------------------------------------------------------
-- Dry-run: plan bridge of exactly two leads (phone-anchor + email-anchor)
-- ---------------------------------------------------------------------------
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

  v_winner := public._lead_merge_pick_winner(
    p_organization_id,
    ARRAY[p_phone_lead_id, p_email_lead_id]
  );
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

-- ---------------------------------------------------------------------------
-- Execute: soft-merge via _lead_merge_execute_cluster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_checkout_identity_bridge_execute(
  p_organization_id uuid,
  p_phone_lead_id uuid,
  p_email_lead_id uuid,
  p_confirm boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_plan jsonb;
  v_winner uuid;
  v_losers uuid[];
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  IF coalesce(p_confirm, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'confirm_required'
      USING ERRCODE = 'P0001',
            HINT = 'Call merge_checkout_identity_bridge_execute(org, phone_lead, email_lead, true) after dry_run.';
  END IF;

  v_plan := public.merge_checkout_identity_bridge_dry_run(
    p_organization_id,
    p_phone_lead_id,
    p_email_lead_id
  );

  IF coalesce((v_plan->>'skipped')::boolean, false) THEN
    RETURN v_plan || jsonb_build_object('merged', false);
  END IF;

  v_winner := (v_plan->>'winner_lead_id')::uuid;
  v_losers := ARRAY(SELECT jsonb_array_elements_text(v_plan->'loser_lead_ids')::uuid);

  PERFORM public._lead_merge_execute_cluster(
    p_organization_id,
    'checkout_bridge',
    v_plan->>'cluster_key',
    v_winner,
    v_losers,
    v_actor
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'skipped', false,
    'skip_reason', NULL,
    'winner_lead_id', v_winner,
    'loser_lead_ids', to_jsonb(v_losers),
    'cluster_key', v_plan->>'cluster_key',
    'phone_lead_id', p_phone_lead_id,
    'email_lead_id', p_email_lead_id,
    'merged', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid, uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid, uuid, uuid) IS
  'Fase 5: dry-run soft-merge of phone-anchored lead vs email-anchored lead (checkout bridge).';
COMMENT ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean) IS
  'Fase 5: execute checkout identity bridge soft-merge (confirm=true required).';
