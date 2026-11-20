-- Fase 4a + 4b: typo email merge + identity graph soft-merge RPCs.
-- Reuses _lead_merge_execute_cluster / _lead_merge_assert_org_access / _lead_merge_pick_winner.
-- Graph rule: union leads that share phone_key OR email_key (bridge = lead with both).

ALTER TABLE public.lead_merge_events
  DROP CONSTRAINT IF EXISTS lead_merge_events_cluster_kind_check;

ALTER TABLE public.lead_merge_events
  ADD CONSTRAINT lead_merge_events_cluster_kind_check
  CHECK (cluster_kind IN ('phone', 'email', 'typo_email', 'identity_graph'));

CREATE OR REPLACE FUNCTION public._lead_merge_is_valid_identity_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  n text;
  domain text;
BEGIN
  n := lower(btrim(COALESCE(p_email, '')));
  IF n = '' OR position('@' IN n) = 0 THEN
    RETURN false;
  END IF;
  IF n !~ '^[^\s@]+@[^\s@]+\.[a-z]{2,24}$' THEN
    RETURN false;
  END IF;
  domain := split_part(n, '@', 2);
  IF domain ~ '(^|\.)(com|net|org|edu|gov|co|io|id|me|app|dev)[a-z]{2,}$' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public._lead_merge_is_typo_domain(p_valid text, p_invalid text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  v text := lower(btrim(COALESCE(p_valid, '')));
  inv text := lower(btrim(COALESCE(p_invalid, '')));
BEGIN
  IF v = '' OR inv = '' OR v = inv THEN
    RETURN false;
  END IF;
  IF inv LIKE v || '%' AND substring(inv from length(v) + 1) ~ '^[a-z]{2,}$' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4a Typo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_typo_email_leads_dry_run(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clusters jsonb := '[]'::jsonb;
  r record;
  v_valid_ids uuid[];
  v_row jsonb;
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  FOR r IN
    SELECT
      l.id AS typo_id,
      lower(btrim(l.email)) AS typo_email,
      split_part(lower(btrim(l.email)), '@', 1) AS local_part,
      split_part(lower(btrim(l.email)), '@', 2) AS typo_domain
    FROM public.leads l
    WHERE l.organization_id = p_organization_id
      AND l.merged_into_lead_id IS NULL
      AND l.email IS NOT NULL
      AND length(btrim(l.email)) > 0
      AND NOT public._lead_merge_is_valid_identity_email(l.email)
  LOOP
    SELECT array_agg(v.id ORDER BY v.created_at)
    INTO v_valid_ids
    FROM public.leads v
    WHERE v.organization_id = p_organization_id
      AND v.merged_into_lead_id IS NULL
      AND public._lead_merge_is_valid_identity_email(v.email)
      AND split_part(lower(btrim(v.email)), '@', 1) = r.local_part
      AND public._lead_merge_is_typo_domain(
        split_part(lower(btrim(v.email)), '@', 2),
        r.typo_domain
      );

    v_valid_ids := COALESCE(v_valid_ids, '{}'::uuid[]);

    IF cardinality(v_valid_ids) = 0 THEN
      v_row := jsonb_build_object(
        'kind', 'typo_email',
        'cluster_key', r.typo_email,
        'lead_ids', jsonb_build_array(r.typo_id),
        'skipped', true,
        'skip_reason', 'no_typo_target',
        'winner_lead_id', NULL,
        'loser_lead_ids', '[]'::jsonb
      );
    ELSIF cardinality(v_valid_ids) > 1 THEN
      v_row := jsonb_build_object(
        'kind', 'typo_email',
        'cluster_key', r.typo_email,
        'lead_ids', to_jsonb(v_valid_ids || r.typo_id),
        'skipped', true,
        'skip_reason', 'ambiguous_typo_target',
        'winner_lead_id', NULL,
        'loser_lead_ids', '[]'::jsonb
      );
    ELSE
      v_row := jsonb_build_object(
        'kind', 'typo_email',
        'cluster_key', r.typo_email,
        'lead_ids', jsonb_build_array(v_valid_ids[1], r.typo_id),
        'skipped', false,
        'skip_reason', NULL,
        'winner_lead_id', v_valid_ids[1],
        'loser_lead_ids', jsonb_build_array(r.typo_id)
      );
    END IF;
    v_clusters := v_clusters || jsonb_build_array(v_row);
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'clusters', v_clusters,
    'mergeable_count', (
      SELECT count(*)::int FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS NOT TRUE
    ),
    'skipped_count', (
      SELECT count(*)::int FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS TRUE
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_typo_email_leads_execute(
  p_organization_id uuid,
  p_confirm boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_dry jsonb;
  v_cluster jsonb;
  v_merged int := 0;
  v_skipped int := 0;
  v_winner uuid;
  v_losers uuid[];
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);
  IF coalesce(p_confirm, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'confirm_required' USING ERRCODE = 'P0001';
  END IF;

  v_dry := public.merge_typo_email_leads_dry_run(p_organization_id);

  FOR v_cluster IN SELECT value FROM jsonb_array_elements(v_dry->'clusters')
  LOOP
    IF coalesce((v_cluster->>'skipped')::boolean, false) THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.lead_merge_events (
        organization_id, cluster_kind, cluster_key, winner_lead_id, loser_lead_ids,
        skipped, skip_reason, created_by
      ) VALUES (
        p_organization_id,
        'typo_email',
        v_cluster->>'cluster_key',
        NULL,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_cluster->'lead_ids')::uuid), '{}'::uuid[]),
        true,
        v_cluster->>'skip_reason',
        v_actor
      );
      CONTINUE;
    END IF;

    v_winner := (v_cluster->>'winner_lead_id')::uuid;
    v_losers := ARRAY(SELECT jsonb_array_elements_text(v_cluster->'loser_lead_ids')::uuid);
    PERFORM public._lead_merge_execute_cluster(
      p_organization_id,
      'typo_email',
      v_cluster->>'cluster_key',
      v_winner,
      v_losers,
      v_actor
    );
    v_merged := v_merged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'merged_clusters', v_merged,
    'skipped_clusters', v_skipped,
    'remaining', public.merge_typo_email_leads_dry_run(p_organization_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4b Identity graph: union-find on lead ids via shared phone_key / email_key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_identity_graph_leads_dry_run(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clusters jsonb := '[]'::jsonb;
  v_row jsonb;
  r record;
  v_ids uuid[];
  v_attr_count int;
  v_winner uuid;
  v_losers uuid[];
  v_comp_key text;
  v_updated int;
  i int;
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  -- Build parent map via iterative min-id union on shared keys
  CREATE TEMP TABLE IF NOT EXISTS _ig_leads (
    id uuid PRIMARY KEY,
    phone_key text,
    email_key text,
    root uuid
  ) ON COMMIT DROP;
  TRUNCATE _ig_leads;

  INSERT INTO _ig_leads (id, phone_key, email_key, root)
  SELECT
    l.id,
    public.normalize_wa_phone_key(l.phone_number),
    CASE
      WHEN public._lead_merge_is_valid_identity_email(l.email) THEN lower(btrim(l.email))
      ELSE NULL
    END,
    l.id
  FROM public.leads l
  WHERE l.organization_id = p_organization_id
    AND l.merged_into_lead_id IS NULL
    AND (
      public.normalize_wa_phone_key(l.phone_number) IS NOT NULL
      OR public._lead_merge_is_valid_identity_email(l.email)
    );

  -- Iterate unions until stable (shared phone or email → min root)
  FOR i IN 1..20 LOOP
    UPDATE _ig_leads a
    SET root = s.new_root
    FROM (
      SELECT x.id, m.min_root AS new_root
      FROM _ig_leads x
      JOIN LATERAL (
        SELECT min(y.root::text)::uuid AS min_root
        FROM _ig_leads y
        WHERE
          (x.phone_key IS NOT NULL AND y.phone_key = x.phone_key)
          OR (x.email_key IS NOT NULL AND y.email_key = x.email_key)
          OR y.id = x.id
      ) m ON true
      WHERE x.root IS DISTINCT FROM m.min_root
    ) s
    WHERE a.id = s.id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    EXIT WHEN v_updated = 0;
  END LOOP;

  -- Path compression pass: set root to min root in component
  UPDATE _ig_leads a
  SET root = s.min_root
  FROM (
    SELECT root AS old_root, min(id::text)::uuid AS min_root
    FROM _ig_leads
    GROUP BY root
  ) s
  WHERE a.root = s.old_root;

  FOR r IN
    SELECT root, array_agg(id ORDER BY id) AS lead_ids
    FROM _ig_leads
    GROUP BY root
    HAVING count(*) >= 2
  LOOP
    v_ids := r.lead_ids;
    v_comp_key := r.root::text;

    SELECT count(*)::int
    INTO v_attr_count
    FROM public.leads l
    WHERE l.id = ANY (v_ids)
      AND public._lead_merge_is_attributed(p_organization_id, l.id, l.source, l.ticket_id);

    IF v_attr_count > 1 THEN
      v_row := jsonb_build_object(
        'kind', 'identity_graph',
        'cluster_key', v_comp_key,
        'lead_ids', to_jsonb(v_ids),
        'skipped', true,
        'skip_reason', 'ambiguous_attributed',
        'winner_lead_id', NULL,
        'loser_lead_ids', '[]'::jsonb
      );
    ELSE
      v_winner := public._lead_merge_pick_winner(p_organization_id, v_ids);
      v_losers := array(SELECT x FROM unnest(v_ids) AS x WHERE x IS DISTINCT FROM v_winner);
      v_row := jsonb_build_object(
        'kind', 'identity_graph',
        'cluster_key', v_comp_key,
        'lead_ids', to_jsonb(v_ids),
        'skipped', false,
        'skip_reason', NULL,
        'winner_lead_id', v_winner,
        'loser_lead_ids', to_jsonb(v_losers)
      );
    END IF;
    v_clusters := v_clusters || jsonb_build_array(v_row);
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'clusters', v_clusters,
    'mergeable_count', (
      SELECT count(*)::int FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS NOT TRUE
    ),
    'skipped_count', (
      SELECT count(*)::int FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS TRUE
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_identity_graph_leads_execute(
  p_organization_id uuid,
  p_confirm boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_dry jsonb;
  v_cluster jsonb;
  v_merged int := 0;
  v_skipped int := 0;
  v_winner uuid;
  v_losers uuid[];
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);
  IF coalesce(p_confirm, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'confirm_required' USING ERRCODE = 'P0001';
  END IF;

  v_dry := public.merge_identity_graph_leads_dry_run(p_organization_id);

  FOR v_cluster IN SELECT value FROM jsonb_array_elements(v_dry->'clusters')
  LOOP
    IF coalesce((v_cluster->>'skipped')::boolean, false) THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.lead_merge_events (
        organization_id, cluster_kind, cluster_key, winner_lead_id, loser_lead_ids,
        skipped, skip_reason, created_by
      ) VALUES (
        p_organization_id,
        'identity_graph',
        v_cluster->>'cluster_key',
        NULL,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_cluster->'lead_ids')::uuid), '{}'::uuid[]),
        true,
        v_cluster->>'skip_reason',
        v_actor
      );
      CONTINUE;
    END IF;

    v_winner := (v_cluster->>'winner_lead_id')::uuid;
    v_losers := ARRAY(SELECT jsonb_array_elements_text(v_cluster->'loser_lead_ids')::uuid);
    PERFORM public._lead_merge_execute_cluster(
      p_organization_id,
      'identity_graph',
      v_cluster->>'cluster_key',
      v_winner,
      v_losers,
      v_actor
    );
    v_merged := v_merged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'merged_clusters', v_merged,
    'skipped_clusters', v_skipped,
    'remaining', public.merge_identity_graph_leads_dry_run(p_organization_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_typo_email_leads_execute(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_identity_graph_leads_execute(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_typo_email_leads_execute(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_execute(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) IS
  'Fase 4a: report typo email → valid email merge clusters.';
COMMENT ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) IS
  'Fase 4b: report identity-graph components (shared phone/email keys / bridges).';
