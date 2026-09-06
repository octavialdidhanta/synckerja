-- Fase 3: soft-archive duplicate customer leads (same normalized phone OR email per org).
-- Schema + dry_run/execute RPCs. Unique indexes ship in a follow-up migration after cleanup.

-- ---------------------------------------------------------------------------
-- 1) Soft-archive columns on leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS merged_into_lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE INDEX IF NOT EXISTS idx_leads_merged_into
  ON public.leads (merged_into_lead_id)
  WHERE merged_into_lead_id IS NOT NULL;

COMMENT ON COLUMN public.leads.merged_into_lead_id IS
  'Fase 3 soft-archive: points at winner lead after identity merge. Active leads have NULL.';

-- ---------------------------------------------------------------------------
-- 2) Audit table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cluster_kind text NOT NULL CHECK (cluster_kind IN ('phone', 'email')),
  cluster_key text NOT NULL,
  winner_lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  loser_lead_ids uuid[] NOT NULL DEFAULT '{}',
  skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_lead_merge_events_org_created
  ON public.lead_merge_events (organization_id, created_at DESC);

ALTER TABLE public.lead_merge_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_merge_events_select_org ON public.lead_merge_events;
CREATE POLICY lead_merge_events_select_org
  ON public.lead_merge_events
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.lead_merge_events IS
  'Audit log for Fase 3 customer lead identity merges (dry-run skips + execute merges).';

-- ---------------------------------------------------------------------------
-- 3) POS phone collision guards: ignore soft-archived losers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_guard_pos_checkout_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF upper(btrim(COALESCE(NEW.source, ''))) <> 'POS' THEN
    RETURN NEW;
  END IF;
  v_key := public.normalize_wa_phone_key(NEW.phone_number);
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.leads AS e
    WHERE e.organization_id = NEW.organization_id
      AND e.merged_into_lead_id IS NULL
      AND e.phone_number IS NOT NULL
      AND public.normalize_wa_phone_key(e.phone_number) = v_key
  ) THEN
    RAISE EXCEPTION 'pos_checkout_phone_exists'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.leads_guard_pos_checkout_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_old_source text;
  v_new_source text;
BEGIN
  v_old_source := btrim(COALESCE(OLD.source, ''));
  v_new_source := btrim(COALESCE(NEW.source, ''));
  IF v_old_source <> '' AND upper(v_new_source) = 'POS' AND upper(v_old_source) <> 'POS' THEN
    NEW.source := OLD.source;
  END IF;

  IF OLD.attribution IS NOT NULL THEN
    NEW.attribution := OLD.attribution;
  END IF;
  IF OLD.attribution_label IS NOT NULL AND btrim(OLD.attribution_label) <> '' THEN
    NEW.attribution_label := OLD.attribution_label;
  END IF;
  IF OLD.ticket_id IS NOT NULL AND btrim(OLD.ticket_id) <> '' THEN
    NEW.ticket_id := OLD.ticket_id;
  END IF;

  IF NOT public.is_generic_customer_name(OLD.client)
     AND public.is_generic_customer_name(NEW.client) THEN
    NEW.client := OLD.client;
  END IF;

  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    v_key := public.normalize_wa_phone_key(NEW.phone_number);
    IF v_key IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.leads AS e
      WHERE e.organization_id = NEW.organization_id
        AND e.id IS DISTINCT FROM NEW.id
        AND e.merged_into_lead_id IS NULL
        AND e.phone_number IS NOT NULL
        AND public.normalize_wa_phone_key(e.phone_number) = v_key
    ) THEN
      RAISE EXCEPTION 'pos_checkout_phone_exists'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Synckerja Order ensure_lead: exclude merged losers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._synckerja_order_ensure_lead(
  p_org uuid,
  p_actor uuid,
  p_status uuid,
  p_client text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead uuid;
  v_existing_client text;
  v_phone text;
  v_email text;
  v_phone_key text;
  v_client text;
BEGIN
  v_client := COALESCE(NULLIF(btrim(p_client), ''), 'Walk-in');
  IF public.is_generic_customer_name(v_client) THEN
    v_client := 'Walk-in';
  END IF;
  v_phone := NULLIF(left(btrim(COALESCE(p_phone, '')), 32), '');
  v_email := NULLIF(left(btrim(COALESCE(p_email, '')), 120), '');
  v_phone_key := public.normalize_wa_phone_key(v_phone);

  IF v_phone_key IS NOT NULL THEN
    SELECT l.id, l.client
    INTO v_lead, v_existing_client
    FROM public.leads l
    WHERE l.organization_id = p_org
      AND l.merged_into_lead_id IS NULL
      AND l.phone_number IS NOT NULL
      AND public.normalize_wa_phone_key(l.phone_number) = v_phone_key
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC
    LIMIT 1;

    IF v_lead IS NOT NULL THEN
      IF public.is_generic_customer_name(v_existing_client)
         AND NOT public.is_generic_customer_name(v_client) THEN
        UPDATE public.leads SET client = v_client WHERE id = v_lead;
      END IF;
      IF v_email IS NOT NULL THEN
        UPDATE public.leads
        SET email = COALESCE(NULLIF(btrim(email), ''), v_email)
        WHERE id = v_lead;
      END IF;
      RETURN v_lead;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.leads (
      ticket_id, client, title, category, created_by, created_by_name, assignee,
      status_id, organization_id, source, followup, phone_number, email
    ) VALUES (
      'pos-walkin-' || gen_random_uuid()::text,
      v_client,
      'POS Walk-in',
      'POS',
      p_actor,
      'Synckerja Order',
      '',
      p_status,
      p_org,
      'POS',
      0,
      v_phone,
      v_email
    ) RETURNING id INTO v_lead;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%pos_checkout_phone_exists%' AND v_phone_key IS NOT NULL THEN
        SELECT l.id INTO v_lead
        FROM public.leads l
        WHERE l.organization_id = p_org
          AND l.merged_into_lead_id IS NULL
          AND l.phone_number IS NOT NULL
          AND public.normalize_wa_phone_key(l.phone_number) = v_phone_key
        ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC
        LIMIT 1;
        IF v_lead IS NULL THEN
          RAISE;
        END IF;
      ELSE
        RAISE;
      END IF;
  END;

  RETURN v_lead;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Helpers: auth, attributed, winner pick
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._lead_merge_assert_org_access(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_session text;
  v_current text;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required' USING ERRCODE = 'P0001';
  END IF;

  -- Dashboard SQL Editor / migrations run as DB owner, not JWT service_role.
  v_session := session_user;
  v_current := current_user;
  IF v_session IN ('postgres', 'supabase_admin')
     OR v_current IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  v_role := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  IF v_role = 'service_role' THEN
    RETURN;
  END IF;
  IF p_organization_id IN (SELECT public.user_organization_ids()) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public._lead_merge_is_attributed(
  p_organization_id uuid,
  p_lead_id uuid,
  p_source text,
  p_ticket_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(COALESCE(p_source, '')) = 'Lead Magnet'
    OR upper(btrim(COALESCE(p_ticket_id, ''))) LIKE 'LEAD-%'
    OR EXISTS (
      SELECT 1
      FROM public.lead_magnet_enrollments e
      WHERE e.organization_id = p_organization_id
        AND e.lead_id = p_lead_id
    );
$$;

CREATE OR REPLACE FUNCTION public._lead_merge_pick_winner(
  p_organization_id uuid,
  p_lead_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner uuid;
BEGIN
  SELECT l.id
  INTO v_winner
  FROM public.leads l
  WHERE l.organization_id = p_organization_id
    AND l.id = ANY (p_lead_ids)
    AND l.merged_into_lead_id IS NULL
  ORDER BY
    CASE
      WHEN public._lead_merge_is_attributed(p_organization_id, l.id, l.source, l.ticket_id)
      THEN 1 ELSE 0
    END DESC,
    CASE
      WHEN public.is_generic_customer_name(l.client) THEN 0
      ELSE 1
    END DESC,
    COALESCE(l.updated_at, l.created_at) DESC NULLS LAST,
    l.created_at DESC NULLS LAST
  LIMIT 1;

  RETURN v_winner;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Dry-run: report mergeable / skipped clusters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_customer_lead_duplicates_dry_run(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clusters jsonb := '[]'::jsonb;
  r record;
  v_ids uuid[];
  v_attr_count int;
  v_winner uuid;
  v_losers uuid[];
  v_row jsonb;
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  FOR r IN
    SELECT
      'phone'::text AS kind,
      public.normalize_wa_phone_key(l.phone_number) AS cluster_key,
      array_agg(l.id ORDER BY l.created_at) AS lead_ids
    FROM public.leads l
    WHERE l.organization_id = p_organization_id
      AND l.merged_into_lead_id IS NULL
      AND l.phone_number IS NOT NULL
      AND public.normalize_wa_phone_key(l.phone_number) IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) >= 2
  LOOP
    v_ids := r.lead_ids;
    SELECT count(*)::int
    INTO v_attr_count
    FROM public.leads l
    WHERE l.id = ANY (v_ids)
      AND public._lead_merge_is_attributed(p_organization_id, l.id, l.source, l.ticket_id);

    IF v_attr_count > 1 THEN
      v_row := jsonb_build_object(
        'kind', r.kind,
        'cluster_key', r.cluster_key,
        'lead_ids', to_jsonb(v_ids),
        'skipped', true,
        'skip_reason', 'ambiguous_attributed',
        'winner_lead_id', NULL,
        'loser_lead_ids', '[]'::jsonb
      );
    ELSE
      v_winner := public._lead_merge_pick_winner(p_organization_id, v_ids);
      v_losers := array(
        SELECT x FROM unnest(v_ids) AS x WHERE x IS DISTINCT FROM v_winner
      );
      v_row := jsonb_build_object(
        'kind', r.kind,
        'cluster_key', r.cluster_key,
        'lead_ids', to_jsonb(v_ids),
        'skipped', false,
        'skip_reason', NULL,
        'winner_lead_id', v_winner,
        'loser_lead_ids', to_jsonb(v_losers)
      );
    END IF;
    v_clusters := v_clusters || jsonb_build_array(v_row);
  END LOOP;

  FOR r IN
    SELECT
      'email'::text AS kind,
      lower(btrim(l.email)) AS cluster_key,
      array_agg(l.id ORDER BY l.created_at) AS lead_ids
    FROM public.leads l
    WHERE l.organization_id = p_organization_id
      AND l.merged_into_lead_id IS NULL
      AND l.email IS NOT NULL
      AND length(btrim(l.email)) > 0
    GROUP BY 1, 2
    HAVING count(*) >= 2
  LOOP
    v_ids := r.lead_ids;
    SELECT count(*)::int
    INTO v_attr_count
    FROM public.leads l
    WHERE l.id = ANY (v_ids)
      AND public._lead_merge_is_attributed(p_organization_id, l.id, l.source, l.ticket_id);

    IF v_attr_count > 1 THEN
      v_row := jsonb_build_object(
        'kind', r.kind,
        'cluster_key', r.cluster_key,
        'lead_ids', to_jsonb(v_ids),
        'skipped', true,
        'skip_reason', 'ambiguous_attributed',
        'winner_lead_id', NULL,
        'loser_lead_ids', '[]'::jsonb
      );
    ELSE
      v_winner := public._lead_merge_pick_winner(p_organization_id, v_ids);
      v_losers := array(
        SELECT x FROM unnest(v_ids) AS x WHERE x IS DISTINCT FROM v_winner
      );
      v_row := jsonb_build_object(
        'kind', r.kind,
        'cluster_key', r.cluster_key,
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
      SELECT count(*)::int
      FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS NOT TRUE
    ),
    'skipped_count', (
      SELECT count(*)::int
      FROM jsonb_array_elements(v_clusters) c
      WHERE (c->>'skipped')::boolean IS TRUE
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Execute one cluster (rebind + coalesce + soft-archive)
-- ---------------------------------------------------------------------------
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
  v_loser uuid;
  v_phone text;
  v_email text;
  v_client text;
  v_w_phone text;
  v_w_email text;
  v_w_client text;
BEGIN
  IF p_winner IS NULL OR p_losers IS NULL OR cardinality(p_losers) = 0 THEN
    RETURN;
  END IF;

  -- Drop losers that were already archived or no longer active
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

  -- SET NULL FKs (simple rebinds)
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

  -- customer_visits: skip rows that would violate one-matched-per-lead-per-day
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

  -- CASCADE / unique children: reassign only when winner has no row
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

  -- Coalesce identity onto winner from losers
  SELECT phone_number, email, client
  INTO v_w_phone, v_w_email, v_w_client
  FROM public.leads
  WHERE id = p_winner;

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

  -- Soft-archive losers: clear identity so unique indexes can apply later
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

-- ---------------------------------------------------------------------------
-- 8) Execute all mergeable clusters for an org (phone then email)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_customer_lead_duplicates_execute(
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
  v_kind text;
  v_key text;
  v_winner uuid;
  v_losers uuid[];
BEGIN
  PERFORM public._lead_merge_assert_org_access(p_organization_id);

  IF coalesce(p_confirm, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'confirm_required'
      USING ERRCODE = 'P0001',
            HINT = 'Call merge_customer_lead_duplicates_execute(org_id, true) after reviewing dry_run.';
  END IF;

  v_dry := public.merge_customer_lead_duplicates_dry_run(p_organization_id);

  FOR v_cluster IN
    SELECT value FROM jsonb_array_elements(v_dry->'clusters')
  LOOP
    IF (v_cluster->>'kind') <> 'phone' THEN
      CONTINUE;
    END IF;

    IF coalesce((v_cluster->>'skipped')::boolean, false) THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.lead_merge_events (
        organization_id, cluster_kind, cluster_key, winner_lead_id, loser_lead_ids,
        skipped, skip_reason, created_by
      ) VALUES (
        p_organization_id,
        v_cluster->>'kind',
        v_cluster->>'cluster_key',
        NULL,
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(v_cluster->'lead_ids')::uuid),
          '{}'::uuid[]
        ),
        true,
        v_cluster->>'skip_reason',
        v_actor
      );
      CONTINUE;
    END IF;

    v_kind := v_cluster->>'kind';
    v_key := v_cluster->>'cluster_key';
    v_winner := (v_cluster->>'winner_lead_id')::uuid;
    v_losers := ARRAY(
      SELECT jsonb_array_elements_text(v_cluster->'loser_lead_ids')::uuid
    );

    PERFORM public._lead_merge_execute_cluster(
      p_organization_id,
      v_kind,
      v_key,
      v_winner,
      v_losers,
      v_actor
    );
    v_merged := v_merged + 1;
  END LOOP;

  -- Email pass (fresh dry_run after phone clears identity on losers)
  v_dry := public.merge_customer_lead_duplicates_dry_run(p_organization_id);
  FOR v_cluster IN
    SELECT value FROM jsonb_array_elements(v_dry->'clusters')
  LOOP
    IF (v_cluster->>'kind') <> 'email' THEN
      CONTINUE;
    END IF;

    IF coalesce((v_cluster->>'skipped')::boolean, false) THEN
      v_skipped := v_skipped + 1;
      INSERT INTO public.lead_merge_events (
        organization_id, cluster_kind, cluster_key, winner_lead_id, loser_lead_ids,
        skipped, skip_reason, created_by
      ) VALUES (
        p_organization_id,
        v_cluster->>'kind',
        v_cluster->>'cluster_key',
        NULL,
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(v_cluster->'lead_ids')::uuid),
          '{}'::uuid[]
        ),
        true,
        v_cluster->>'skip_reason',
        v_actor
      );
      CONTINUE;
    END IF;

    v_winner := (v_cluster->>'winner_lead_id')::uuid;
    v_losers := ARRAY(
      SELECT jsonb_array_elements_text(v_cluster->'loser_lead_ids')::uuid
    );
    PERFORM public._lead_merge_execute_cluster(
      p_organization_id,
      'email',
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
    'remaining', public.merge_customer_lead_duplicates_dry_run(p_organization_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._lead_merge_assert_org_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._lead_merge_is_attributed(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._lead_merge_pick_winner(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._lead_merge_execute_cluster(uuid, text, text, uuid, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_customer_lead_duplicates_execute(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_execute(uuid, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) IS
  'Fase 3: report phone/email duplicate lead clusters for one organization (no writes).';
COMMENT ON FUNCTION public.merge_customer_lead_duplicates_execute(uuid, boolean) IS
  'Fase 3: soft-archive duplicate leads per org. Requires p_confirm=true after dry_run review.';
