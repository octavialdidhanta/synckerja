-- Attribute POS receipt feedback to catalog items (product/bundle) per outlet.
-- Public storefront shows good ratings (rating >= 4) only.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pos_receipt_feedback_item_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pos_outlet_id uuid REFERENCES public.pos_outlets (id) ON DELETE SET NULL,
  response_id uuid NOT NULL REFERENCES public.pos_receipt_feedback_responses (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL,
  item_kind text NOT NULL CHECK (item_kind = ANY (ARRAY['product'::text, 'bundle'::text])),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_receipt_feedback_item_attributions_response_item_unique
    UNIQUE (response_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_item_attr_outlet_item
  ON public.pos_receipt_feedback_item_attributions (pos_outlet_id, catalog_item_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_receipt_feedback_item_attr_outlet_good
  ON public.pos_receipt_feedback_item_attributions (pos_outlet_id, catalog_item_id)
  WHERE rating >= 4;

COMMENT ON TABLE public.pos_receipt_feedback_item_attributions IS
  'Visit-level receipt feedback projected onto each distinct catalog product/bundle on the bill (per outlet).';

ALTER TABLE public.pos_receipt_feedback_item_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_receipt_feedback_item_attributions_block_authenticated
  ON public.pos_receipt_feedback_item_attributions;
CREATE POLICY pos_receipt_feedback_item_attributions_block_authenticated
  ON public.pos_receipt_feedback_item_attributions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Sync helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_pos_receipt_feedback_item_attributions(p_response_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp public.pos_receipt_feedback_responses%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF p_response_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_resp
  FROM public.pos_receipt_feedback_responses
  WHERE id = p_response_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  WITH line_items AS (
    SELECT DISTINCT ON (catalog_item_id)
      catalog_item_id,
      item_kind
    FROM (
      SELECT
        sai.catalog_product_id AS catalog_item_id,
        'product'::text AS item_kind
      FROM public.sales_activity_items sai
      WHERE sai.sales_activity_id = v_resp.sales_activity_id
        AND sai.catalog_product_id IS NOT NULL
        AND sai.catalog_bundle_id IS NULL
      UNION ALL
      SELECT
        sai.catalog_bundle_id AS catalog_item_id,
        'bundle'::text AS item_kind
      FROM public.sales_activity_items sai
      WHERE sai.sales_activity_id = v_resp.sales_activity_id
        AND sai.catalog_bundle_id IS NOT NULL
    ) x
    WHERE catalog_item_id IS NOT NULL
    ORDER BY catalog_item_id, item_kind
  ),
  upserted AS (
    INSERT INTO public.pos_receipt_feedback_item_attributions (
      organization_id,
      pos_outlet_id,
      response_id,
      sales_activity_id,
      catalog_item_id,
      item_kind,
      rating,
      comment,
      submitted_at
    )
    SELECT
      v_resp.organization_id,
      v_resp.pos_outlet_id,
      v_resp.id,
      v_resp.sales_activity_id,
      li.catalog_item_id,
      li.item_kind,
      v_resp.rating,
      v_resp.comment,
      v_resp.submitted_at
    FROM line_items li
    ON CONFLICT (response_id, catalog_item_id) DO UPDATE
      SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        submitted_at = EXCLUDED.submitted_at,
        pos_outlet_id = EXCLUDED.pos_outlet_id,
        item_kind = EXCLUDED.item_kind
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_inserted FROM upserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Hook submit RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_public_pos_receipt_feedback(
  p_token uuid,
  p_rating integer,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.pos_receipt_feedback_invitations%ROWTYPE;
  v_response_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  SELECT i.* INTO v_inv
  FROM public.pos_receipt_feedback_invitations i
  WHERE i.public_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pos_receipt_feedback_responses r WHERE r.invitation_id = v_inv.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  INSERT INTO public.pos_receipt_feedback_responses (
    invitation_id,
    organization_id,
    sales_activity_id,
    pos_outlet_id,
    served_by_employee_id,
    rating,
    comment
  )
  VALUES (
    v_inv.id,
    v_inv.organization_id,
    v_inv.sales_activity_id,
    v_inv.pos_outlet_id,
    v_inv.served_by_employee_id,
    p_rating::smallint,
    nullif(trim(coalesce(p_comment, '')), '')
  )
  RETURNING id INTO v_response_id;

  PERFORM public.sync_pos_receipt_feedback_item_attributions(v_response_id);

  RETURN jsonb_build_object('ok', true, 'thank_you_message', 'Thank you for your feedback!');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_pos_receipt_feedback(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill existing responses
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.pos_receipt_feedback_responses ORDER BY submitted_at
  LOOP
    PERFORM public.sync_pos_receipt_feedback_item_attributions(r.id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs (good ratings only: rating >= 4)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_order_product_rating_summaries(
  p_code text,
  p_catalog_item_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_rows jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'summaries', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'catalog_item_id', s.catalog_item_id,
        'avg_rating', s.avg_rating,
        'rating_count', s.rating_count
      )
      ORDER BY s.catalog_item_id
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      a.catalog_item_id,
      ROUND(AVG(a.rating)::numeric, 1) AS avg_rating,
      COUNT(*)::integer AS rating_count
    FROM public.pos_receipt_feedback_item_attributions a
    WHERE a.pos_outlet_id = v_out.outlet_id
      AND a.organization_id = v_out.organization_id
      AND a.rating >= 4
      AND (
        p_catalog_item_ids IS NULL
        OR cardinality(p_catalog_item_ids) = 0
        OR a.catalog_item_id = ANY (p_catalog_item_ids)
      )
    GROUP BY a.catalog_item_id
  ) s;

  RETURN jsonb_build_object('ok', true, 'summaries', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_order_product_rating_summaries(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_product_rating_summaries(text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_order_product_reviews(
  p_code text,
  p_catalog_item_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_avg numeric;
  v_count integer;
  v_reviews jsonb;
  v_limit integer;
  v_offset integer;
BEGIN
  IF p_catalog_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
  v_offset := GREATEST(0, COALESCE(p_offset, 0));

  SELECT
    ROUND(AVG(a.rating)::numeric, 1),
    COUNT(*)::integer
  INTO v_avg, v_count
  FROM public.pos_receipt_feedback_item_attributions a
  WHERE a.pos_outlet_id = v_out.outlet_id
    AND a.organization_id = v_out.organization_id
    AND a.catalog_item_id = p_catalog_item_id
    AND a.rating >= 4;

  SELECT COALESCE(
    jsonb_agg(row_json ORDER BY submitted_at DESC),
    '[]'::jsonb
  )
  INTO v_reviews
  FROM (
    SELECT
      jsonb_build_object(
        'id', a.id,
        'rating', a.rating,
        'comment', a.comment,
        'submitted_at', a.submitted_at,
        'reply_text', r.reply_text,
        'replied_at', r.replied_at
      ) AS row_json,
      a.submitted_at
    FROM public.pos_receipt_feedback_item_attributions a
    JOIN public.pos_receipt_feedback_responses r ON r.id = a.response_id
    WHERE a.pos_outlet_id = v_out.outlet_id
      AND a.organization_id = v_out.organization_id
      AND a.catalog_item_id = p_catalog_item_id
      AND a.rating >= 4
      AND a.comment IS NOT NULL
      AND length(trim(a.comment)) > 0
    ORDER BY a.submitted_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'catalog_item_id', p_catalog_item_id,
    'avg_rating', v_avg,
    'rating_count', COALESCE(v_count, 0),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_order_product_reviews(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_product_reviews(text, uuid, integer, integer) TO anon, authenticated;
