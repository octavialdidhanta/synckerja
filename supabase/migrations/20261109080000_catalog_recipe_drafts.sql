-- Recipe drafts: Claude proposes, a person reviews and publishes in the app.
--
-- Safety model
--   * Drafts live in their own table. Nothing in POS, checkout, stock or reports reads it.
--   * Only publish_recipe_draft writes the live recipe, and only for an organization owner/admin,
--     in one transaction: snapshot the old recipe to history, replace the lines, mark the draft.
--   * The MCP service role can create and list drafts; it has no publish function.
--   * A draft remembers a fingerprint of the live recipe it was based on. If the live recipe changed
--     since (e.g. edited on the Recipes page), publish is blocked instead of silently overwriting.
--   * Warnings (no buy cost, unusual quantity, removed ingredient, HPP change > 20%) must be
--     confirmed explicitly; blocking problems (stale, deleted ingredient, expired) cannot be confirmed.
--   * Quantities are stored in each ingredient's own unit, like catalog_product_recipe_lines.
--   * HPP follows the POS checkout rule: ingredient avg_cost at the draft's outlet when it tracks COGS.

CREATE TABLE IF NOT EXISTS public.catalog_recipe_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices(id) ON DELETE CASCADE,
  draft_type text NOT NULL CHECK (draft_type IN ('new', 'update')),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  base_fingerprint text NOT NULL DEFAULT '',
  request_note text CHECK (request_note IS NULL OR char_length(request_note) <= 1000),
  source text NOT NULL DEFAULT 'claude' CHECK (source IN ('claude', 'app')),
  requested_by uuid NOT NULL,
  edited_by uuid,
  edited_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected', 'superseded', 'expired')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open draft per menu: a newer draft supersedes the older one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_recipe_drafts_pending_product
  ON public.catalog_recipe_drafts (product_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_catalog_recipe_drafts_org_status
  ON public.catalog_recipe_drafts (organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.catalog_product_recipe_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices(id) ON DELETE CASCADE,
  recipe_id uuid,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'draft_publish',
  draft_id uuid REFERENCES public.catalog_recipe_drafts(id) ON DELETE SET NULL,
  replaced_by uuid,
  replaced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_product_recipe_history_product
  ON public.catalog_product_recipe_history (organization_id, product_id, replaced_at DESC);

ALTER TABLE public.catalog_recipe_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_product_recipe_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_recipe_drafts_select_member ON public.catalog_recipe_drafts;
CREATE POLICY catalog_recipe_drafts_select_member ON public.catalog_recipe_drafts
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS catalog_product_recipe_history_select_member ON public.catalog_product_recipe_history;
CREATE POLICY catalog_product_recipe_history_select_member ON public.catalog_product_recipe_history
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

REVOKE INSERT, UPDATE, DELETE ON public.catalog_recipe_drafts FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.catalog_product_recipe_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.catalog_recipe_drafts TO authenticated;
GRANT SELECT ON public.catalog_product_recipe_history TO authenticated;
GRANT ALL ON public.catalog_recipe_drafts TO service_role;
GRANT ALL ON public.catalog_product_recipe_history TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers

CREATE OR REPLACE FUNCTION public._recipe_is_member(p_user uuid, p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p_user IS NOT NULL AND p_org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_user AND uo.organization_id = p_org AND COALESCE(uo.is_active, true)
  );
$fn$;

CREATE OR REPLACE FUNCTION public._recipe_is_manager(p_user uuid, p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public._recipe_is_member(p_user, p_org) AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user AND ur.organization_id = p_org AND ur.role IN ('owner', 'admin')
  );
$fn$;

-- Fingerprint of a product's live base recipe: ingredient + quantity, order-independent. '' when none.
CREATE OR REPLACE FUNCTION public.catalog_recipe_fingerprint(p_product uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    md5(string_agg(l.ingredient_id::text || ':' || trim_scale(l.quantity)::text, '|' ORDER BY l.ingredient_id)),
    ''
  )
  FROM public.catalog_product_recipes r
  JOIN public.catalog_product_recipe_lines l ON l.recipe_id = r.id
  WHERE r.product_id = p_product AND r.modifier_option_id IS NULL;
$fn$;

-- Validate draft lines given as [{ingredient_id, quantity}] (quantity in the ingredient's unit).
-- Returns the normalized array. Raises on anything a recipe line could not hold.
CREATE OR REPLACE FUNCTION public._recipe_draft_check_lines(p_org uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_id uuid;
  v_qty numeric;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_name text;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
    OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 50 THEN
    RAISE EXCEPTION 'recipe_draft_lines_invalid' USING ERRCODE = '22023';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_id := (v_elem ->> 'ingredient_id')::uuid;
      v_qty := (v_elem ->> 'quantity')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'recipe_draft_lines_invalid' USING ERRCODE = '22023';
    END;
    IF v_id IS NULL OR v_qty IS NULL THEN
      RAISE EXCEPTION 'recipe_draft_lines_invalid' USING ERRCODE = '22023';
    END IF;

    SELECT i.name INTO v_name
    FROM public.catalog_ingredients i
    WHERE i.id = v_id AND i.organization_id = p_org AND i.is_deleted = false;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'recipe_draft_ingredient_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_id = ANY (v_seen) THEN
      RAISE EXCEPTION '%', 'recipe_draft_duplicate_ingredient: ' || v_name USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || v_id;

    v_qty := round(v_qty, 3);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION '%', 'recipe_draft_quantity_too_small: ' || v_name USING ERRCODE = '22023';
    END IF;
    IF v_qty > 100000 THEN
      RAISE EXCEPTION '%', 'recipe_draft_quantity_too_large: ' || v_name USING ERRCODE = '22023';
    END IF;

    v_out := v_out || jsonb_build_object('ingredient_id', v_id, 'quantity', v_qty);
  END LOOP;

  RETURN v_out;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Review: everything the app and Claude show about one draft, computed in one place.

CREATE OR REPLACE FUNCTION public._recipe_draft_review(p_draft_id uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d public.catalog_recipe_drafts%ROWTYPE;
  v_product text;
  v_category text;
  v_outlet text;
  v_price numeric;
  v_fg boolean;
  v_effective_status text;
  v_before jsonb;
  v_rows jsonb;
  v_hpp_before numeric;
  v_hpp_after numeric;
  v_warnings jsonb := '[]'::jsonb;
  v_blocking jsonb := '[]'::jsonb;
  v_names jsonb;
  v_has_live boolean;
BEGIN
  SELECT * INTO d FROM public.catalog_recipe_drafts WHERE id = p_draft_id;
  IF NOT FOUND OR NOT public._recipe_is_member(p_user, d.organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT dp.name, cat.name, COALESCE(link.unit_price, dp.unit_price), COALESCE(link.track_cogs, false)
    INTO v_product, v_category, v_price, v_fg
  FROM public.default_prices dp
  LEFT JOIN public.catalog_product_categories cat ON cat.id = dp.product_category_id
  LEFT JOIN public.catalog_product_outlets link
    ON link.product_id = dp.id AND link.outlet_id = d.outlet_id AND link.organization_id = d.organization_id
  WHERE dp.id = d.product_id;

  SELECT o.name INTO v_outlet FROM public.pos_outlets o WHERE o.id = d.outlet_id;

  v_effective_status := CASE
    WHEN d.status = 'pending' AND d.expires_at <= now() THEN 'expired'
    ELSE d.status
  END;

  -- "Before" is the live recipe for an open draft, and the replaced recipe for a published one.
  IF d.status = 'published' THEN
    SELECT h.lines INTO v_before
    FROM public.catalog_product_recipe_history h
    WHERE h.draft_id = d.id
    ORDER BY h.replaced_at DESC
    LIMIT 1;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('ingredient_id', l.ingredient_id, 'quantity', l.quantity)), '[]'::jsonb)
      INTO v_before
    FROM public.catalog_product_recipes r
    JOIN public.catalog_product_recipe_lines l ON l.recipe_id = r.id
    WHERE r.product_id = d.product_id AND r.modifier_option_id IS NULL;
  END IF;
  v_before := COALESCE(v_before, '[]'::jsonb);
  v_has_live := jsonb_array_length(v_before) > 0;

  WITH bef AS (
    SELECT (e ->> 'ingredient_id')::uuid AS ingredient_id, (e ->> 'quantity')::numeric AS qty
    FROM jsonb_array_elements(v_before) e
  ),
  aft AS (
    SELECT (e ->> 'ingredient_id')::uuid AS ingredient_id, (e ->> 'quantity')::numeric AS qty, ord
    FROM jsonb_array_elements(d.lines) WITH ORDINALITY AS t(e, ord)
  ),
  joined AS (
    SELECT
      COALESCE(a.ingredient_id, b.ingredient_id) AS ingredient_id,
      b.qty AS before_qty,
      a.qty AS after_qty,
      COALESCE(a.ord, 1000) AS ord
    FROM aft a
    FULL OUTER JOIN bef b ON b.ingredient_id = a.ingredient_id
  ),
  priced AS (
    SELECT
      j.*,
      i.name,
      i.unit_code,
      i.kind,
      COALESCE(i.is_deleted, true) AS deleted,
      CASE WHEN COALESCE(io.track_cogs, false) THEN COALESCE(io.avg_cost, 0) ELSE 0 END AS unit_cost,
      (COALESCE(io.track_cogs, false) AND COALESCE(io.avg_cost, 0) > 0) AS has_cost
    FROM joined j
    LEFT JOIN public.catalog_ingredients i ON i.id = j.ingredient_id
    LEFT JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = j.ingredient_id AND io.outlet_id = d.outlet_id AND io.organization_id = d.organization_id
  ),
  shaped AS (
    SELECT
      p.*,
      COALESCE(p.before_qty, 0) * p.unit_cost AS before_cost,
      COALESCE(p.after_qty, 0) * p.unit_cost AS after_cost,
      CASE
        WHEN p.after_qty IS NULL THEN 'removed'
        WHEN p.before_qty IS NULL THEN 'new'
        WHEN p.after_qty <> p.before_qty THEN 'changed'
        ELSE 'same'
      END AS change,
      (p.after_qty IS NOT NULL AND (
        (p.unit_code IN ('kg', 'l') AND p.after_qty > 1)
        OR (p.unit_code IN ('g', 'ml') AND p.after_qty > 1000)
        OR (p.before_qty IS NOT NULL AND p.before_qty > 0 AND p.after_qty / p.before_qty >= 5)
      )) AS unusual
    FROM priced p
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'ingredient_id', s.ingredient_id,
      'name', COALESCE(s.name, '(bahan tidak ditemukan)'),
      'unit_code', s.unit_code,
      'kind', s.kind,
      'deleted', s.deleted,
      'unit_cost', s.unit_cost,
      'has_cost', s.has_cost,
      'before_qty', s.before_qty,
      'after_qty', s.after_qty,
      'before_cost', round(s.before_cost, 2),
      'after_cost', round(s.after_cost, 2),
      'delta_cost', round(s.after_cost - s.before_cost, 2),
      'change', s.change,
      'unusual', s.unusual
    ) ORDER BY s.ord, s.name), '[]'::jsonb),
    COALESCE(SUM(s.before_cost), 0),
    COALESCE(SUM(s.after_cost), 0)
  INTO v_rows, v_hpp_before, v_hpp_after
  FROM shaped s;

  -- Blocking problems: cannot be confirmed away.
  IF v_effective_status <> 'pending' THEN
    v_blocking := v_blocking || jsonb_build_object('code', 'not_pending', 'status', v_effective_status);
  END IF;
  IF d.status = 'pending' AND d.base_fingerprint <> public.catalog_recipe_fingerprint(d.product_id) THEN
    v_blocking := v_blocking || jsonb_build_object('code', 'stale');
  END IF;
  SELECT jsonb_agg(r ->> 'name') INTO v_names
  FROM jsonb_array_elements(v_rows) r
  WHERE (r ->> 'after_qty') IS NOT NULL AND (r ->> 'deleted')::boolean;
  IF v_names IS NOT NULL THEN
    v_blocking := v_blocking || jsonb_build_object('code', 'deleted_ingredient', 'items', v_names);
  END IF;
  IF jsonb_array_length(d.lines) = 0 THEN
    v_blocking := v_blocking || jsonb_build_object('code', 'empty');
  END IF;

  -- Warnings: need an explicit confirmation to publish.
  SELECT jsonb_agg(r ->> 'name') INTO v_names
  FROM jsonb_array_elements(v_rows) r
  WHERE (r ->> 'after_qty') IS NOT NULL AND NOT (r ->> 'has_cost')::boolean AND NOT (r ->> 'deleted')::boolean;
  IF v_names IS NOT NULL THEN
    v_warnings := v_warnings || jsonb_build_object('code', 'missing_cost', 'items', v_names);
  END IF;
  SELECT jsonb_agg(r ->> 'name') INTO v_names
  FROM jsonb_array_elements(v_rows) r WHERE (r ->> 'unusual')::boolean;
  IF v_names IS NOT NULL THEN
    v_warnings := v_warnings || jsonb_build_object('code', 'unusual_quantity', 'items', v_names);
  END IF;
  SELECT jsonb_agg(r ->> 'name') INTO v_names
  FROM jsonb_array_elements(v_rows) r WHERE r ->> 'change' = 'removed';
  IF v_names IS NOT NULL THEN
    v_warnings := v_warnings || jsonb_build_object('code', 'removed_ingredient', 'items', v_names);
  END IF;
  IF v_hpp_before > 0 AND abs(v_hpp_after - v_hpp_before) / v_hpp_before > 0.2 THEN
    v_warnings := v_warnings || jsonb_build_object(
      'code', 'hpp_change',
      'percent', round((v_hpp_after - v_hpp_before) / v_hpp_before * 100, 1)
    );
  END IF;

  RETURN jsonb_build_object(
    'draft', jsonb_build_object(
      'id', d.id,
      'status', v_effective_status,
      'draft_type', d.draft_type,
      'source', d.source,
      'product_id', d.product_id,
      'product_name', v_product,
      'category', v_category,
      'outlet_id', d.outlet_id,
      'outlet_name', v_outlet,
      'request_note', d.request_note,
      'requested_by_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = d.requested_by LIMIT 1),
      'created_at', d.created_at,
      'edited', d.edited_at IS NOT NULL,
      'edited_by_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = d.edited_by LIMIT 1),
      'edited_at', d.edited_at,
      'expires_at', d.expires_at,
      'decided_at', d.decided_at,
      'decided_by_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = d.decided_by LIMIT 1),
      'decision_note', d.decision_note
    ),
    'can_manage', public._recipe_is_manager(p_user, d.organization_id),
    'has_live_recipe', v_has_live,
    'selling_price', v_price,
    'finished_goods_cost', v_fg,
    'rows', v_rows,
    'original_lines', d.original_lines,
    'totals', jsonb_build_object(
      'hpp_before', CASE WHEN v_has_live THEN round(v_hpp_before, 2) END,
      'hpp_after', round(v_hpp_after, 2),
      'delta', CASE WHEN v_has_live THEN round(v_hpp_after - v_hpp_before, 2) END,
      'margin_before', CASE WHEN v_has_live THEN round(v_price - v_hpp_before, 2) END,
      'margin_after', round(v_price - v_hpp_after, 2),
      'margin_pct_before', CASE WHEN v_has_live AND v_price > 0 THEN round((v_price - v_hpp_before) / v_price * 100, 1) END,
      'margin_pct_after', CASE WHEN v_price > 0 THEN round((v_price - v_hpp_after) / v_price * 100, 1) END
    ),
    'warnings', v_warnings,
    'blocking', v_blocking,
    'requires_confirmation', jsonb_array_length(v_warnings) > 0,
    'can_publish', jsonb_array_length(v_blocking) = 0 AND public._recipe_is_manager(p_user, d.organization_id)
  );
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Create (shared by MCP; validates lines, supersedes the older open draft)

CREATE OR REPLACE FUNCTION public._recipe_draft_insert(
  p_user uuid, p_org uuid, p_outlet uuid, p_product uuid, p_lines jsonb, p_note text, p_source text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lines jsonb;
  v_id uuid;
  v_fp text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_note IS NOT NULL AND char_length(v_note) > 1000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_lines := public._recipe_draft_check_lines(p_org, p_lines);
  v_fp := public.catalog_recipe_fingerprint(p_product);

  UPDATE public.catalog_recipe_drafts
  SET status = 'superseded', decided_at = now(), updated_at = now()
  WHERE product_id = p_product AND status = 'pending';

  INSERT INTO public.catalog_recipe_drafts (
    organization_id, outlet_id, product_id, draft_type, lines, original_lines,
    base_fingerprint, request_note, source, requested_by
  ) VALUES (
    p_org, p_outlet, p_product, CASE WHEN v_fp = '' THEN 'new' ELSE 'update' END,
    v_lines, v_lines, v_fp, v_note, p_source, p_user
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- MCP: names and units as the user says them. Converts g/kg/mg/ons and ml/l to the ingredient's unit.
CREATE OR REPLACE FUNCTION public.mcp_create_recipe_draft(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_product_name text,
  p_lines jsonb,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_outlet uuid;
  v_product uuid;
  v_count integer;
  v_labels text;
  v_elem jsonb;
  v_name text;
  v_unit text;
  v_qty numeric;
  v_ing record;
  v_factor_in numeric;
  v_factor_ing numeric;
  v_base numeric;
  v_missing text[] := ARRAY[]::text[];
  v_mismatch text[] := ARRAY[]::text[];
  v_small text[] := ARRAY[]::text[];
  v_lines jsonb := '[]'::jsonb;
  v_id uuid;
  v_mass constant jsonb := '{"mg":0.000001,"g":0.001,"ons":0.1,"kg":1}';
  v_volume constant jsonb := '{"ml":0.001,"l":1}';
BEGIN
  IF NOT public._recipe_is_member(p_user_id, p_organization_id) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF NOT public._recipe_is_manager(p_user_id, p_organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
    OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 50 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_outlet_id IS NULL THEN
    SELECT o.id INTO v_outlet FROM public.pos_outlets o
    WHERE o.organization_id = p_organization_id AND o.is_deleted = false AND o.is_active = true
    ORDER BY o.is_default DESC, o.sort_order, o.created_at LIMIT 1;
  ELSE
    SELECT o.id INTO v_outlet FROM public.pos_outlets o
    WHERE o.id = p_outlet_id AND o.organization_id = p_organization_id AND o.is_deleted = false;
  END IF;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), max(dp.id::text), string_agg(dp.name, ' | ')
    INTO v_count, v_labels, v_name
  FROM public.default_prices dp
  WHERE dp.organization_id = p_organization_id AND dp.kind = 'product'
    AND lower(btrim(dp.name)) = lower(btrim(COALESCE(p_product_name, '')));
  IF v_count = 0 THEN
    RAISE EXCEPTION 'menu_not_found' USING ERRCODE = 'P0002';
  ELSIF v_count > 1 THEN
    RAISE EXCEPTION '%', 'ambiguous: ' || v_name USING ERRCODE = '22023';
  END IF;
  v_product := v_labels::uuid;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_name := btrim(COALESCE(v_elem ->> 'ingredient', ''));
    v_unit := lower(btrim(COALESCE(v_elem ->> 'unit', '')));
    BEGIN
      v_qty := (v_elem ->> 'quantity')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END;
    IF v_name = '' OR v_unit = '' OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT i.id, i.name, i.unit_code INTO v_ing
    FROM public.catalog_ingredients i
    WHERE i.organization_id = p_organization_id AND i.is_deleted = false
      AND lower(btrim(i.name)) = lower(v_name)
    LIMIT 1;
    IF NOT FOUND THEN
      v_missing := v_missing || v_name;
      CONTINUE;
    END IF;

    IF v_unit = lower(v_ing.unit_code) THEN
      v_base := v_qty;
    ELSIF v_mass ? v_unit AND v_mass ? lower(v_ing.unit_code) THEN
      v_factor_in := (v_mass ->> v_unit)::numeric;
      v_factor_ing := (v_mass ->> lower(v_ing.unit_code))::numeric;
      v_base := v_qty * v_factor_in / v_factor_ing;
    ELSIF v_volume ? v_unit AND v_volume ? lower(v_ing.unit_code) THEN
      v_factor_in := (v_volume ->> v_unit)::numeric;
      v_factor_ing := (v_volume ->> lower(v_ing.unit_code))::numeric;
      v_base := v_qty * v_factor_in / v_factor_ing;
    ELSE
      v_mismatch := v_mismatch || (v_ing.name || ' (' || v_ing.unit_code || ')');
      CONTINUE;
    END IF;

    IF round(v_base, 3) <= 0 THEN
      v_small := v_small || (v_ing.name || ' (' || v_ing.unit_code || ')');
      CONTINUE;
    END IF;

    v_lines := v_lines || jsonb_build_object('ingredient_id', v_ing.id, 'quantity', round(v_base, 3));
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION '%', 'ingredient_not_found: ' || array_to_string(v_missing, ' | ') USING ERRCODE = 'P0002';
  END IF;
  IF cardinality(v_mismatch) > 0 THEN
    RAISE EXCEPTION '%', 'unit_mismatch: ' || array_to_string(v_mismatch, ' | ') USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_small) > 0 THEN
    RAISE EXCEPTION '%', 'recipe_draft_quantity_too_small: ' || array_to_string(v_small, ' | ') USING ERRCODE = '22023';
  END IF;

  v_id := public._recipe_draft_insert(p_user_id, p_organization_id, v_outlet, v_product, v_lines, p_note, 'claude');
  RETURN public._recipe_draft_review(v_id, p_user_id);
END;
$fn$;

-- MCP / app: list drafts (pending by default). Expired pending drafts are reported as expired.
CREATE OR REPLACE FUNCTION public._recipe_draft_list(p_user uuid, p_org uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status text := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'pending');
  v_out jsonb := '[]'::jsonb;
  v_row record;
  v_review jsonb;
BEGIN
  IF NOT public._recipe_is_member(p_user, p_org) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('pending', 'published', 'rejected', 'superseded', 'expired', 'all') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN
    SELECT d.id
    FROM public.catalog_recipe_drafts d
    WHERE d.organization_id = p_org
      AND (
        v_status = 'all'
        OR (v_status = 'pending' AND d.status = 'pending' AND d.expires_at > now())
        OR (v_status = 'expired' AND (d.status = 'expired' OR (d.status = 'pending' AND d.expires_at <= now())))
        OR (v_status NOT IN ('pending', 'expired') AND d.status = v_status)
      )
    ORDER BY d.created_at DESC
    LIMIT 50
  LOOP
    v_review := public._recipe_draft_review(v_row.id, p_user);
    v_out := v_out || jsonb_build_object(
      'id', v_row.id,
      'product_name', v_review #>> '{draft,product_name}',
      'draft_type', v_review #>> '{draft,draft_type}',
      'status', v_review #>> '{draft,status}',
      'requested_by_name', v_review #>> '{draft,requested_by_name}',
      'request_note', v_review #>> '{draft,request_note}',
      'created_at', v_review #> '{draft,created_at}',
      'edited', v_review #> '{draft,edited}',
      'line_count', (SELECT count(*) FROM jsonb_array_elements(v_review -> 'rows') r WHERE (r ->> 'after_qty') IS NOT NULL),
      'hpp_before', v_review #> '{totals,hpp_before}',
      'hpp_after', v_review #> '{totals,hpp_after}',
      'warning_count', jsonb_array_length(v_review -> 'warnings'),
      'blocked', jsonb_array_length(v_review -> 'blocking') > 0
    );
  END LOOP;

  RETURN jsonb_build_object('status', v_status, 'drafts', v_out);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mcp_list_recipe_drafts(p_user_id uuid, p_organization_id uuid, p_status text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public._recipe_draft_list(p_user_id, p_organization_id, p_status);
$fn$;

-- ---------------------------------------------------------------------------
-- App functions (signed-in user via auth.uid()).

CREATE OR REPLACE FUNCTION public.list_recipe_drafts(p_organization_id uuid, p_status text DEFAULT 'pending')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public._recipe_draft_list(auth.uid(), p_organization_id, p_status);
$fn$;

CREATE OR REPLACE FUNCTION public.get_recipe_draft_review(p_draft_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public._recipe_draft_review(p_draft_id, auth.uid());
$fn$;

CREATE OR REPLACE FUNCTION public.update_recipe_draft(p_draft_id uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d public.catalog_recipe_drafts%ROWTYPE;
  v_user uuid := auth.uid();
  v_lines jsonb;
BEGIN
  SELECT * INTO d FROM public.catalog_recipe_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR NOT public._recipe_is_member(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public._recipe_is_manager(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF d.status <> 'pending' OR d.expires_at <= now() THEN
    RAISE EXCEPTION 'recipe_draft_not_pending' USING ERRCODE = '22023';
  END IF;

  v_lines := public._recipe_draft_check_lines(d.organization_id, p_lines);

  UPDATE public.catalog_recipe_drafts
  SET lines = v_lines, edited_by = v_user, edited_at = now(), updated_at = now()
  WHERE id = d.id;

  RETURN public._recipe_draft_review(d.id, v_user);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.publish_recipe_draft(p_draft_id uuid, p_confirm_warnings boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d public.catalog_recipe_drafts%ROWTYPE;
  v_user uuid := auth.uid();
  v_review jsonb;
  v_recipe uuid;
  v_old jsonb;
BEGIN
  SELECT * INTO d FROM public.catalog_recipe_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR NOT public._recipe_is_member(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public._recipe_is_manager(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Lock the live recipe row (if any) so a concurrent page save cannot interleave.
  SELECT r.id INTO v_recipe
  FROM public.catalog_product_recipes r
  WHERE r.product_id = d.product_id AND r.modifier_option_id IS NULL
  FOR UPDATE;

  v_review := public._recipe_draft_review(d.id, v_user);
  IF jsonb_array_length(v_review -> 'blocking') > 0 THEN
    RAISE EXCEPTION '%', 'recipe_draft_blocked: ' || (
      SELECT string_agg(b ->> 'code', ',') FROM jsonb_array_elements(v_review -> 'blocking') b
    ) USING ERRCODE = '22023';
  END IF;
  IF (v_review ->> 'requires_confirmation')::boolean AND NOT COALESCE(p_confirm_warnings, false) THEN
    RAISE EXCEPTION 'recipe_draft_confirmation_required' USING ERRCODE = '22023';
  END IF;

  IF v_recipe IS NULL THEN
    INSERT INTO public.catalog_product_recipes (organization_id, product_id)
    VALUES (d.organization_id, d.product_id)
    RETURNING id INTO v_recipe;
    v_old := '[]'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('ingredient_id', l.ingredient_id, 'quantity', l.quantity)
             ORDER BY l.sort_order), '[]'::jsonb)
      INTO v_old
    FROM public.catalog_product_recipe_lines l
    WHERE l.recipe_id = v_recipe;
  END IF;

  INSERT INTO public.catalog_product_recipe_history (organization_id, product_id, recipe_id, lines, source, draft_id, replaced_by)
  VALUES (d.organization_id, d.product_id, v_recipe, v_old, 'draft_publish', d.id, v_user);

  DELETE FROM public.catalog_product_recipe_lines WHERE recipe_id = v_recipe;

  INSERT INTO public.catalog_product_recipe_lines (recipe_id, ingredient_id, organization_id, quantity, sort_order)
  SELECT v_recipe, (e ->> 'ingredient_id')::uuid, d.organization_id, (e ->> 'quantity')::numeric, ord::integer
  FROM jsonb_array_elements(d.lines) WITH ORDINALITY AS t(e, ord);

  UPDATE public.catalog_product_recipes SET updated_at = now() WHERE id = v_recipe;

  UPDATE public.catalog_recipe_drafts
  SET status = 'published', decided_by = v_user, decided_at = now(), updated_at = now()
  WHERE id = d.id;

  RETURN public._recipe_draft_review(d.id, v_user);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reject_recipe_draft(p_draft_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d public.catalog_recipe_drafts%ROWTYPE;
  v_user uuid := auth.uid();
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  SELECT * INTO d FROM public.catalog_recipe_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND OR NOT public._recipe_is_member(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public._recipe_is_manager(v_user, d.organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF d.status <> 'pending' THEN
    RAISE EXCEPTION 'recipe_draft_not_pending' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  UPDATE public.catalog_recipe_drafts
  SET status = 'rejected', decided_by = v_user, decided_at = now(), decision_note = v_note, updated_at = now()
  WHERE id = d.id;

  RETURN public._recipe_draft_review(d.id, v_user);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Grants: internal helpers for service_role only; app functions for signed-in users.

REVOKE ALL ON FUNCTION public._recipe_is_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recipe_is_manager(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_recipe_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recipe_draft_check_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recipe_draft_review(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recipe_draft_insert(uuid, uuid, uuid, uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recipe_draft_list(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_recipe_draft(uuid, uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_list_recipe_drafts(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_recipe_draft(uuid, uuid, uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_list_recipe_drafts(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.list_recipe_drafts(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recipe_draft_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_recipe_draft(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_recipe_draft(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_recipe_draft(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_recipe_drafts(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recipe_draft_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_recipe_draft(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_recipe_draft(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_recipe_draft(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
