-- Daftar Klaim: one place for every fact an organization may say about itself (brand, product, location).
-- A claim is stored once and used by every module (brief, video, Thinking Lab, AI Employee, inbox, ads).
--   product_claims        the claim sentence, its proof, its status and expiry. Code KL01, KL02, ... per org.
--   product_claim_scopes  where it applies: the whole brand, one or more catalog products, one or more locations.
--   product_claim_uses    which content used it (filled by later modules).
-- Rules enforced in the database, for Office (RLS) and MCP alike:
--   * only an owner or admin approves or rejects; anyone else's new claim starts as needs_proof;
--   * changing an approved claim's sentence, or its scope, sends it back to needs_proof;
--   * an approved claim past valid_until goes back to needs_proof (daily job, and on every write).
-- Proof files live in catalog-media under <org>/claims/.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  seq integer NOT NULL,
  code text NOT NULL,
  text text NOT NULL,
  proof text,
  proof_file_path text,
  status text NOT NULL DEFAULT 'needs_proof',
  rejection_reason text,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  valid_until date,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_claims_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT product_claims_org_code_key UNIQUE (organization_id, code),
  CONSTRAINT product_claims_org_seq_key UNIQUE (organization_id, seq),
  CONSTRAINT product_claims_status_check CHECK (status IN ('needs_proof', 'approved', 'rejected')),
  CONSTRAINT product_claims_text_check CHECK (char_length(btrim(text)) BETWEEN 3 AND 500),
  CONSTRAINT product_claims_proof_check CHECK (proof IS NULL OR char_length(proof) <= 2000),
  CONSTRAINT product_claims_reason_check CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500),
  CONSTRAINT product_claims_proof_file_check CHECK (
    proof_file_path IS NULL
    OR (
      char_length(proof_file_path) <= 500
      AND split_part(proof_file_path, '/', 1) = organization_id::text
      AND split_part(proof_file_path, '/', 2) = 'claims'
      AND proof_file_path !~ '(^|/)\.\.(/|$)'
    )
  )
);

COMMENT ON TABLE public.product_claims IS
  'Daftar Klaim. One fact the organization may state, with proof. Used by briefs, videos, Thinking Lab, AI Employee, inbox and ads.';
COMMENT ON COLUMN public.product_claims.code IS 'Short code per organization: KL01, KL02, ... Assigned on insert, never reused.';
COMMENT ON COLUMN public.product_claims.proof_file_path IS 'catalog-media path <org>/claims/<file>.';
COMMENT ON COLUMN public.product_claims.valid_until IS 'Optional. After this date an approved claim goes back to needs_proof.';

CREATE INDEX product_claims_org_status_idx ON public.product_claims (organization_id, status);

CREATE TABLE public.product_claim_scopes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  scope text NOT NULL,
  menu_id uuid,
  location_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_claim_scopes_claim_fkey
    FOREIGN KEY (claim_id, organization_id) REFERENCES public.product_claims (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT product_claim_scopes_menu_fkey
    FOREIGN KEY (menu_id, organization_id) REFERENCES public.catalog_menus (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT product_claim_scopes_location_fkey
    FOREIGN KEY (location_id, organization_id) REFERENCES public.catalog_locations (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT product_claim_scopes_shape_check CHECK (
    (scope = 'brand' AND menu_id IS NULL AND location_id IS NULL)
    OR (scope = 'product' AND menu_id IS NOT NULL AND location_id IS NULL)
    OR (scope = 'location' AND location_id IS NOT NULL AND menu_id IS NULL)
  )
);

COMMENT ON TABLE public.product_claim_scopes IS
  'Where a claim applies. brand = every product and location. A claim can have several products and locations.';

CREATE UNIQUE INDEX product_claim_scopes_unique_idx
  ON public.product_claim_scopes (claim_id, scope, COALESCE(menu_id, location_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX product_claim_scopes_org_idx ON public.product_claim_scopes (organization_id);
CREATE INDEX product_claim_scopes_menu_idx ON public.product_claim_scopes (menu_id) WHERE menu_id IS NOT NULL;
CREATE INDEX product_claim_scopes_location_idx ON public.product_claim_scopes (location_id) WHERE location_id IS NOT NULL;

CREATE TABLE public.product_claim_uses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  module text NOT NULL,
  ref_id text NOT NULL,
  label text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_claim_uses_claim_fkey
    FOREIGN KEY (claim_id, organization_id) REFERENCES public.product_claims (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT product_claim_uses_module_check CHECK (
    module IN ('brief', 'video', 'thinking_lab', 'ai_employee', 'inbox', 'ads', 'product_knowledge', 'other')
  ),
  CONSTRAINT product_claim_uses_ref_check CHECK (char_length(btrim(ref_id)) BETWEEN 1 AND 200),
  CONSTRAINT product_claim_uses_label_check CHECK (label IS NULL OR char_length(label) <= 300),
  CONSTRAINT product_claim_uses_unique UNIQUE (claim_id, module, ref_id)
);

COMMENT ON TABLE public.product_claim_uses IS 'Jejak pemakaian: which brief, video, idea or message used a claim.';

CREATE INDEX product_claim_uses_org_idx ON public.product_claim_uses (organization_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_claims_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$ SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date $$;

-- True when the caller may approve: an owner/admin session, or a trusted server context (no auth.uid()).
-- MCP functions run without auth.uid() and check the role themselves (mcp_claims_require_admin).
CREATE OR REPLACE FUNCTION public.product_claims_caller_is_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NULL OR public.user_is_org_owner_or_admin(p_organization_id)
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_claims_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.product_claims_caller_is_admin(NEW.organization_id);
  v_status_changed boolean;
BEGIN
  NEW.text := btrim(NEW.text);
  NEW.proof := NULLIF(btrim(COALESCE(NEW.proof, '')), '');
  NEW.rejection_reason := NULLIF(btrim(COALESCE(NEW.rejection_reason, '')), '');

  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('product_claims:' || NEW.organization_id::text, 0));
    SELECT COALESCE(max(c.seq), 0) + 1 INTO NEW.seq FROM public.product_claims c WHERE c.organization_id = NEW.organization_id;
    NEW.code := 'KL' || lpad(NEW.seq::text, 2, '0');
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    IF NOT v_admin THEN
      NEW.status := 'needs_proof';
    END IF;
    v_status_changed := NEW.status <> 'needs_proof';
  ELSE
    IF NEW.organization_id <> OLD.organization_id OR NEW.seq <> OLD.seq OR NEW.code <> OLD.code THEN
      RAISE EXCEPTION 'claim_identity_locked' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    v_status_changed := NEW.status IS DISTINCT FROM OLD.status;
    IF v_status_changed AND NEW.status <> 'needs_proof' AND NOT v_admin THEN
      RAISE EXCEPTION 'owner_admin_only' USING ERRCODE = '42501';
    END IF;
    -- A new sentence must be checked again, unless an admin approves it in the same change.
    IF NEW.text IS DISTINCT FROM OLD.text AND OLD.status = 'approved' AND NOT (v_status_changed AND v_admin) THEN
      NEW.status := 'needs_proof';
      v_status_changed := true;
    END IF;
    IF NOT v_status_changed THEN
      NEW.approved_by := OLD.approved_by;
      NEW.approved_at := OLD.approved_at;
    END IF;
    NEW.updated_at := now();
  END IF;

  IF NEW.status = 'approved' AND NEW.valid_until IS NOT NULL AND NEW.valid_until < public.product_claims_today() THEN
    NEW.status := 'needs_proof';
    v_status_changed := true;
  END IF;

  IF v_status_changed THEN
    IF NEW.status = 'needs_proof' THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.rejection_reason := NULL;
    ELSE
      NEW.approved_by := COALESCE(auth.uid(), NEW.approved_by);
      NEW.approved_at := now();
      IF NEW.status = 'approved' THEN
        NEW.rejection_reason := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_claims_before_write
  BEFORE INSERT OR UPDATE ON public.product_claims
  FOR EACH ROW EXECUTE FUNCTION public.product_claims_before_write();

-- A member who adds or removes where an approved claim applies sends it back for approval.
CREATE OR REPLACE FUNCTION public.product_claim_scopes_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.product_claim_scopes%ROWTYPE := COALESCE(NEW, OLD);
BEGIN
  IF NOT public.product_claims_caller_is_admin(v_row.organization_id) THEN
    UPDATE public.product_claims c
    SET status = 'needs_proof'
    WHERE c.id = v_row.claim_id AND c.organization_id = v_row.organization_id AND c.status = 'approved';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER product_claim_scopes_after_change
  AFTER INSERT OR DELETE ON public.product_claim_scopes
  FOR EACH ROW EXECUTE FUNCTION public.product_claim_scopes_after_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_claim_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_claim_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_claims_select ON public.product_claims FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY product_claims_insert ON public.product_claims FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY product_claims_update ON public.product_claims FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY product_claims_delete ON public.product_claims FOR DELETE TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id));

CREATE POLICY product_claim_scopes_org ON public.product_claim_scopes FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY product_claim_uses_org ON public.product_claim_uses FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_claims TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.product_claim_scopes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.product_claim_uses TO authenticated;
GRANT ALL ON TABLE public.product_claims TO service_role;
GRANT ALL ON TABLE public.product_claim_scopes TO service_role;
GRANT ALL ON TABLE public.product_claim_uses TO service_role;

REVOKE ALL ON FUNCTION public.product_claims_caller_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_claims_caller_is_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_claims_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_claim_scopes_after_change() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Proof files: catalog-media <org>/claims/<file>, PDF allowed too.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']::text[]
WHERE id = 'catalog-media';

DROP POLICY IF EXISTS catalog_media_select ON storage.objects;
CREATE POLICY catalog_media_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
    AND (storage.foldername(name))[2] = ANY (ARRAY['thumbs', 'photos', 'previews', 'render-stills', 'claims'])
  );

CREATE POLICY catalog_media_claims_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
    AND (storage.foldername(name))[2] = 'claims'
    AND array_length(storage.foldername(name), 1) = 2
  );

CREATE POLICY catalog_media_claims_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
    AND (storage.foldername(name))[2] = 'claims'
    AND array_length(storage.foldername(name), 1) = 2
  );

-- ---------------------------------------------------------------------------
-- Expiry: approved claims past valid_until go back to needs_proof every day (00:05 WIB).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_claims_expire()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.product_claims c
  SET status = 'needs_proof'
  WHERE c.status = 'approved'
    AND c.valid_until IS NOT NULL
    AND c.valid_until < public.product_claims_today();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.product_claims_expire() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_claims_expire() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'product-claims-expire') THEN
      PERFORM cron.unschedule('product-claims-expire');
    END IF;
    PERFORM cron.schedule('product-claims-expire', '5 17 * * *', 'SELECT public.product_claims_expire()');
  END IF;
END
$cron$;

-- ---------------------------------------------------------------------------
-- MCP: catalog.claims.list, catalog.claims.upsert.preview → catalog.claims.upsert, catalog.claims.approve
-- ---------------------------------------------------------------------------
ALTER TABLE public.mcp_footage_previews DROP CONSTRAINT mcp_footage_previews_tool_check;
ALTER TABLE public.mcp_footage_previews ADD CONSTRAINT mcp_footage_previews_tool_check CHECK (
  tool IN (
    'footage.scenes.upsert_batch',
    'footage.usage.log',
    'footage.move',
    'footage.ban.add',
    'footage.clips.upsert',
    'footage.clips.create',
    'footage.delete',
    'footage.restore',
    'catalog.media.delete',
    'catalog.media.restore',
    'catalog.style.update',
    'catalog.reference.upsert',
    'catalog.shotlist.upsert',
    'render.jobs.create',
    'catalog.claims.upsert'
  )
);

CREATE OR REPLACE FUNCTION public.mcp_claims_require_admin(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.organization_id = p_organization_id AND ur.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'owner_admin_only' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- One claim as the MCP shows it.
CREATE OR REPLACE FUNCTION public.mcp_claim_json(p_claim_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'code', c.code,
    'text', c.text,
    'status', c.status,
    'proof', c.proof,
    'has_proof_file', c.proof_file_path IS NOT NULL,
    'valid_until', c.valid_until,
    'approved_at', c.approved_at,
    'rejection_reason', c.rejection_reason,
    'scopes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'scope', s.scope,
          'product', m.external_id,
          'product_name', m.name,
          'location', l.external_id,
          'location_name', l.name
        ) - (CASE WHEN s.scope = 'product' THEN ARRAY['location', 'location_name']
                  WHEN s.scope = 'location' THEN ARRAY['product', 'product_name']
                  ELSE ARRAY['product', 'product_name', 'location', 'location_name'] END)
        ORDER BY s.scope, m.name, l.name
      )
      FROM public.product_claim_scopes s
      LEFT JOIN public.catalog_menus m ON m.id = s.menu_id
      LEFT JOIN public.catalog_locations l ON l.id = s.location_id
      WHERE s.claim_id = c.id
    ), '[]'::jsonb),
    'uses', (SELECT count(*) FROM public.product_claim_uses u WHERE u.claim_id = c.id)
  )
  FROM public.product_claims c
  WHERE c.id = p_claim_id
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_claims(p_user_id uuid, p_organization_id uuid, p_input jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_status text := NULLIF(v_input->>'status', '');
  v_q text := NULLIF(btrim(COALESCE(v_input->>'q', '')), '');
  v_menu uuid;
  v_location uuid;
  v_claims jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  IF v_status IS NOT NULL AND v_status NOT IN ('needs_proof', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(v_input->>'product', '') IS NOT NULL THEN
    SELECT m.id INTO v_menu FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id AND m.external_id = v_input->>'product';
    IF v_menu IS NULL THEN RAISE EXCEPTION 'unknown_product' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF NULLIF(v_input->>'location', '') IS NOT NULL THEN
    SELECT l.id INTO v_location FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id AND l.external_id = v_input->>'location';
    IF v_location IS NULL THEN RAISE EXCEPTION 'unknown_location' USING ERRCODE = 'P0002'; END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(public.mcp_claim_json(c.id) ORDER BY c.seq), '[]'::jsonb) INTO v_claims
  FROM public.product_claims c
  WHERE c.organization_id = p_organization_id
    AND (v_status IS NULL OR c.status = v_status)
    AND (v_q IS NULL OR c.text ILIKE '%' || v_q || '%' OR c.code ILIKE v_q)
    -- A product or location filter returns the claims that apply there: brand-wide ones plus its own.
    AND (
      (v_menu IS NULL AND v_location IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.product_claim_scopes s
        WHERE s.claim_id = c.id
          AND (s.scope = 'brand' OR s.menu_id = v_menu OR s.location_id = v_location)
      )
    );

  RETURN jsonb_build_object(
    'claims', v_claims,
    'counts', (
      SELECT jsonb_build_object(
        'needs_proof', count(*) FILTER (WHERE c.status = 'needs_proof'),
        'approved', count(*) FILTER (WHERE c.status = 'approved'),
        'rejected', count(*) FILTER (WHERE c.status = 'rejected')
      )
      FROM public.product_claims c WHERE c.organization_id = p_organization_id
    )
  );
END;
$$;

-- Validate and resolve an upsert input. Returns the normalized payload stored in the preview.
CREATE OR REPLACE FUNCTION public.mcp_claim_normalize(p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  v_text text;
  v_proof text;
  v_until date;
  v_scope jsonb;
  v_scopes jsonb := '[]'::jsonb;
  v_id uuid;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_input->>'code', '') IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('code', upper(btrim(p_input->>'code')));
  END IF;
  IF p_input ? 'text' THEN
    v_text := btrim(COALESCE(p_input->>'text', ''));
    IF char_length(v_text) < 3 OR char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'text must be 3 to 500 characters';
    END IF;
    v_out := v_out || jsonb_build_object('text', v_text);
  ELSIF NOT (v_out ? 'code') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'text is required for a new claim';
  END IF;
  IF p_input ? 'proof' THEN
    v_proof := NULLIF(btrim(COALESCE(p_input->>'proof', '')), '');
    IF char_length(COALESCE(v_proof, '')) > 2000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'proof is at most 2000 characters';
    END IF;
    v_out := v_out || jsonb_build_object('proof', v_proof);
  END IF;
  IF p_input ? 'valid_until' THEN
    BEGIN
      v_until := NULLIF(p_input->>'valid_until', '')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'valid_until must be YYYY-MM-DD';
    END;
    IF v_until IS NOT NULL AND v_until < public.product_claims_today() THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'valid_until is in the past';
    END IF;
    v_out := v_out || jsonb_build_object('valid_until', v_until);
  END IF;
  IF p_input ? 'scopes' THEN
    IF jsonb_typeof(p_input->'scopes') <> 'array' OR jsonb_array_length(p_input->'scopes') = 0
       OR jsonb_array_length(p_input->'scopes') > 50 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'scopes must list 1 to 50 entries';
    END IF;
    FOR v_scope IN SELECT * FROM jsonb_array_elements(p_input->'scopes') LOOP
      IF v_scope->>'scope' = 'brand' THEN
        v_scopes := v_scopes || jsonb_build_array(jsonb_build_object('scope', 'brand'));
      ELSIF v_scope->>'scope' = 'product' THEN
        SELECT m.id INTO v_id FROM public.catalog_menus m
        WHERE m.organization_id = p_organization_id AND m.external_id = v_scope->>'product';
        IF v_id IS NULL THEN RAISE EXCEPTION 'unknown_product' USING ERRCODE = 'P0002', DETAIL = v_scope->>'product'; END IF;
        v_scopes := v_scopes || jsonb_build_array(jsonb_build_object('scope', 'product', 'menu_id', v_id));
      ELSIF v_scope->>'scope' = 'location' THEN
        SELECT l.id INTO v_id FROM public.catalog_locations l
        WHERE l.organization_id = p_organization_id AND l.external_id = v_scope->>'location';
        IF v_id IS NULL THEN RAISE EXCEPTION 'unknown_location' USING ERRCODE = 'P0002', DETAIL = v_scope->>'location'; END IF;
        v_scopes := v_scopes || jsonb_build_array(jsonb_build_object('scope', 'location', 'location_id', v_id));
      ELSE
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023', DETAIL = 'scope must be brand, product or location';
      END IF;
    END LOOP;
    SELECT jsonb_agg(DISTINCT e) INTO v_scopes FROM jsonb_array_elements(v_scopes) e;
    v_out := v_out || jsonb_build_object('scopes', v_scopes);
  END IF;
  RETURN v_out;
END;
$$;

-- Fingerprint of a claim and its scopes, to refuse a save when it changed after the preview.
CREATE OR REPLACE FUNCTION public.mcp_claim_fingerprint(p_claim_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT md5(COALESCE(public.mcp_claim_json(p_claim_id)::text, '') || COALESCE((SELECT c.updated_at::text FROM public.product_claims c WHERE c.id = p_claim_id), ''))
$$;

-- Scopes of the normalized payload as the MCP shows them (names instead of ids).
CREATE OR REPLACE FUNCTION public.mcp_claim_scopes_view(p_scopes jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(
    CASE e->>'scope'
      WHEN 'product' THEN jsonb_build_object('scope', 'product', 'product', m.external_id, 'product_name', m.name)
      WHEN 'location' THEN jsonb_build_object('scope', 'location', 'location', l.external_id, 'location_name', l.name)
      ELSE jsonb_build_object('scope', 'brand')
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_scopes, '[]'::jsonb)) e
  LEFT JOIN public.catalog_menus m ON m.id = (e->>'menu_id')::uuid
  LEFT JOIN public.catalog_locations l ON l.id = (e->>'location_id')::uuid
$$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_claim_upsert(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
  v_claim public.product_claims%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_claim_normalize(p_organization_id, p_input);

  DELETE FROM public.mcp_footage_previews WHERE organization_id = p_organization_id AND expires_at <= now();

  IF v_payload ? 'code' THEN
    SELECT * INTO v_claim FROM public.product_claims c
    WHERE c.organization_id = p_organization_id AND c.code = v_payload->>'code';
    IF NOT FOUND THEN RAISE EXCEPTION 'claim_not_found' USING ERRCODE = 'P0002'; END IF;
    v_before := public.mcp_claim_json(v_claim.id);
    v_payload := v_payload || jsonb_build_object('claim_id', v_claim.id, 'fingerprint', public.mcp_claim_fingerprint(v_claim.id));
    v_after := v_before
      || jsonb_build_object('status', 'needs_proof')
      || (v_payload - ARRAY['code', 'claim_id', 'fingerprint', 'scopes'])
      || CASE WHEN v_payload ? 'scopes' THEN jsonb_build_object('scopes', public.mcp_claim_scopes_view(v_payload->'scopes')) ELSE '{}'::jsonb END;
  ELSE
    IF NOT v_payload ? 'scopes' THEN
      v_payload := v_payload || jsonb_build_object('scopes', jsonb_build_array(jsonb_build_object('scope', 'brand')));
    END IF;
    v_after := jsonb_build_object(
      'code', '(baru)',
      'text', v_payload->>'text',
      'status', 'needs_proof',
      'proof', v_payload->'proof',
      'valid_until', v_payload->'valid_until',
      'scopes', public.mcp_claim_scopes_view(v_payload->'scopes')
    );
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (p_organization_id, p_user_id, 'catalog.claims.upsert', v_payload, now() + interval '15 minutes')
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'is_new', v_before IS NULL,
    'before', v_before,
    'after', v_after,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_claim_upsert(p_user_id uuid, p_organization_id uuid, p_preview_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
  v_claim_id uuid;
  v_is_new boolean;
  v_scope jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(p_user_id, p_organization_id, p_preview_id, 'catalog.claims.upsert');
  PERFORM pg_advisory_xact_lock(hashtextextended('product_claims:' || p_organization_id::text, 0));

  v_is_new := NOT v_payload ? 'claim_id';
  IF v_is_new THEN
    INSERT INTO public.product_claims (organization_id, text, proof, valid_until, status, created_by)
    VALUES (
      p_organization_id,
      v_payload->>'text',
      v_payload->>'proof',
      NULLIF(v_payload->>'valid_until', '')::date,
      'needs_proof',
      p_user_id
    )
    RETURNING id INTO v_claim_id;
  ELSE
    v_claim_id := (v_payload->>'claim_id')::uuid;
    PERFORM 1 FROM public.product_claims c WHERE c.id = v_claim_id AND c.organization_id = p_organization_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'claim_not_found' USING ERRCODE = 'P0002'; END IF;
    IF public.mcp_claim_fingerprint(v_claim_id) <> v_payload->>'fingerprint' THEN
      RAISE EXCEPTION 'changed_since_preview' USING ERRCODE = 'P0001';
    END IF;
    -- A change from Claude always waits for an owner or admin again.
    UPDATE public.product_claims c
    SET text = CASE WHEN v_payload ? 'text' THEN v_payload->>'text' ELSE c.text END,
        proof = CASE WHEN v_payload ? 'proof' THEN v_payload->>'proof' ELSE c.proof END,
        valid_until = CASE WHEN v_payload ? 'valid_until' THEN NULLIF(v_payload->>'valid_until', '')::date ELSE c.valid_until END,
        status = 'needs_proof'
    WHERE c.id = v_claim_id AND c.organization_id = p_organization_id;
  END IF;

  IF v_payload ? 'scopes' THEN
    DELETE FROM public.product_claim_scopes s WHERE s.claim_id = v_claim_id AND s.organization_id = p_organization_id;
    FOR v_scope IN SELECT * FROM jsonb_array_elements(v_payload->'scopes') LOOP
      INSERT INTO public.product_claim_scopes (organization_id, claim_id, scope, menu_id, location_id)
      VALUES (
        p_organization_id, v_claim_id, v_scope->>'scope',
        NULLIF(v_scope->>'menu_id', '')::uuid, NULLIF(v_scope->>'location_id', '')::uuid
      );
    END LOOP;
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;
  RETURN jsonb_build_object('saved', true, 'is_new', v_is_new, 'claim', public.mcp_claim_json(v_claim_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_approve_catalog_claim(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claim public.product_claims%ROWTYPE;
  v_decision text := p_input->>'decision';
  v_reason text := NULLIF(btrim(COALESCE(p_input->>'reason', '')), '');
BEGIN
  PERFORM public.mcp_claims_require_admin(p_user_id, p_organization_id);
  IF v_decision NOT IN ('approve', 'reject') OR char_length(COALESCE(v_reason, '')) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_claim FROM public.product_claims c
  WHERE c.organization_id = p_organization_id AND c.code = upper(btrim(COALESCE(p_input->>'code', '')))
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_decision = 'approve' THEN
    IF v_claim.proof IS NULL AND v_claim.proof_file_path IS NULL THEN
      RAISE EXCEPTION 'proof_required' USING ERRCODE = 'P0001';
    END IF;
    IF v_claim.valid_until IS NOT NULL AND v_claim.valid_until < public.product_claims_today() THEN
      RAISE EXCEPTION 'claim_expired' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.product_claims c
  SET status = CASE WHEN v_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
      rejection_reason = CASE WHEN v_decision = 'reject' THEN v_reason ELSE NULL END,
      approved_by = p_user_id
  WHERE c.id = v_claim.id;

  RETURN jsonb_build_object('saved', true, 'claim', public.mcp_claim_json(v_claim.id));
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_claims_require_admin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_claim_json(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_claim_normalize(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_claim_fingerprint(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_claim_scopes_view(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_claims(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_preview_catalog_claim_upsert(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_claim_upsert(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_approve_catalog_claim(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_claims(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_claim_upsert(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_claim_upsert(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_approve_catalog_claim(uuid, uuid, jsonb) TO service_role;
