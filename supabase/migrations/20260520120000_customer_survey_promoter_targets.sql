-- Customer survey: org-wide promoter % target (default 80), per-assignee overrides, CRM summary + admin RPCs.

ALTER TABLE public.organization_customer_survey_settings
  ADD COLUMN IF NOT EXISTS promoter_pct_target numeric(5, 2) NOT NULL DEFAULT 80
    CHECK (promoter_pct_target >= 0 AND promoter_pct_target <= 100);

COMMENT ON COLUMN public.organization_customer_survey_settings.promoter_pct_target IS
  'Org default % promoter target for CRM per-agent status (Achieve/Failed).';

UPDATE public.organization_customer_survey_settings
SET promoter_pct_target = 80
WHERE promoter_pct_target IS NULL;

CREATE TABLE IF NOT EXISTS public.organization_customer_survey_assignee_targets (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  promoter_pct_target numeric(5, 2) NOT NULL
    CHECK (promoter_pct_target >= 0 AND promoter_pct_target <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, assignee_id)
);

COMMENT ON TABLE public.organization_customer_survey_assignee_targets IS
  'Optional per-assignee override for CRM survey promoter % target.';

CREATE INDEX IF NOT EXISTS idx_customer_survey_assignee_targets_org
  ON public.organization_customer_survey_assignee_targets (organization_id);

ALTER TABLE public.organization_customer_survey_assignee_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_survey_assignee_targets_select ON public.organization_customer_survey_assignee_targets;
CREATE POLICY customer_survey_assignee_targets_select
  ON public.organization_customer_survey_assignee_targets
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS customer_survey_assignee_targets_insert ON public.organization_customer_survey_assignee_targets;
CREATE POLICY customer_survey_assignee_targets_insert
  ON public.organization_customer_survey_assignee_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS customer_survey_assignee_targets_update ON public.organization_customer_survey_assignee_targets;
CREATE POLICY customer_survey_assignee_targets_update
  ON public.organization_customer_survey_assignee_targets
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS customer_survey_assignee_targets_delete ON public.organization_customer_survey_assignee_targets;
CREATE POLICY customer_survey_assignee_targets_delete
  ON public.organization_customer_survey_assignee_targets
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- CRM summary (targets per assignee)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_customer_survey_summary(
  p_organization_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_rating smallint := 4;
  v_org_target numeric := 80;
  v_total bigint;
  v_promoters bigint;
  v_pct numeric;
  v_counts jsonb;
  v_by_assignee jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(s.promoter_min_rating, 4), COALESCE(s.promoter_pct_target, 80)
  INTO v_min_rating, v_org_target
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    v_min_rating := 4;
    v_org_target := 80;
  END IF;

  SELECT count(*)::bigint
  INTO v_total
  FROM public.customer_survey_responses r
  WHERE r.organization_id = p_organization_id
    AND r.submitted_at >= p_from
    AND r.submitted_at < p_to;

  SELECT count(*)::bigint
  INTO v_promoters
  FROM public.customer_survey_responses r
  WHERE r.organization_id = p_organization_id
    AND r.submitted_at >= p_from
    AND r.submitted_at < p_to
    AND r.rating >= v_min_rating;

  v_pct := CASE
    WHEN v_total > 0 THEN round((100.0 * v_promoters / v_total)::numeric, 2)
    ELSE 0::numeric
  END;

  SELECT coalesce(
    jsonb_object_agg(rating::text, c),
    '{}'::jsonb
  )
  INTO v_counts
  FROM (
    SELECT r.rating, count(*)::bigint AS c
    FROM public.customer_survey_responses r
    WHERE r.organization_id = p_organization_id
      AND r.submitted_at >= p_from
      AND r.submitted_at < p_to
    GROUP BY r.rating
  ) q;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_by_assignee
  FROM (
    SELECT
      r.assignee_id,
      coalesce(nullif(trim(e.full_name), ''), e.email, r.assignee_id::text) AS assignee_name,
      count(*)::bigint AS response_count,
      count(*) FILTER (WHERE r.rating >= v_min_rating)::bigint AS promoter_count,
      CASE
        WHEN count(*) > 0 THEN round((100.0 * count(*) FILTER (WHERE r.rating >= v_min_rating) / count(*))::numeric, 2)
        ELSE 0::numeric
      END AS promoter_pct,
      coalesce(MAX(at.promoter_pct_target), v_org_target) AS target_promoter_pct,
      (count(at.assignee_id) > 0) AS has_assignee_override,
      jsonb_build_object(
        '1', count(*) FILTER (WHERE r.rating = 1),
        '2', count(*) FILTER (WHERE r.rating = 2),
        '3', count(*) FILTER (WHERE r.rating = 3),
        '4', count(*) FILTER (WHERE r.rating = 4),
        '5', count(*) FILTER (WHERE r.rating = 5)
      ) AS counts_by_rating
    FROM public.customer_survey_responses r
    LEFT JOIN public.employees e ON e.id = r.assignee_id
    LEFT JOIN public.organization_customer_survey_assignee_targets at
      ON at.organization_id = r.organization_id
      AND at.assignee_id = r.assignee_id
    WHERE r.organization_id = p_organization_id
      AND r.submitted_at >= p_from
      AND r.submitted_at < p_to
    GROUP BY r.assignee_id, e.full_name, e.email
    ORDER BY response_count DESC
  ) t;

  RETURN jsonb_build_object(
    'total_responses', v_total,
    'promoter_count', v_promoters,
    'promoter_pct', v_pct,
    'promoter_min_rating', v_min_rating,
    'org_promoter_pct_target', v_org_target,
    'min_responses_for_status', 3,
    'counts_by_rating', coalesce(v_counts, '{}'::jsonb),
    'by_assignee', coalesce(v_by_assignee, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Assignee target override RPCs (owner / omnichannel admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_customer_survey_assignee_target(
  p_organization_id uuid,
  p_assignee_id uuid,
  p_target_pct numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.is_omnichannel_survey_settings_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target_pct < 0 OR p_target_pct > 100 THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = p_assignee_id
      AND e.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'invalid_assignee';
  END IF;

  INSERT INTO public.organization_customer_survey_assignee_targets (
    organization_id,
    assignee_id,
    promoter_pct_target,
    updated_at,
    updated_by
  )
  VALUES (
    p_organization_id,
    p_assignee_id,
    round(p_target_pct::numeric, 2),
    now(),
    auth.uid()
  )
  ON CONFLICT (organization_id, assignee_id) DO UPDATE
  SET
    promoter_pct_target = EXCLUDED.promoter_pct_target,
    updated_at = now(),
    updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_customer_survey_assignee_target(
  p_organization_id uuid,
  p_assignee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.is_omnichannel_survey_settings_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.organization_customer_survey_assignee_targets
  WHERE organization_id = p_organization_id
    AND assignee_id = p_assignee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_customer_survey_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_customer_survey_summary(uuid, timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_customer_survey_assignee_target(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_survey_assignee_target(uuid, uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_customer_survey_assignee_target(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_customer_survey_assignee_target(uuid, uuid) TO authenticated;
