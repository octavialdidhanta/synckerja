-- Brand lockup hashtags (forced onto carousel caption) + brief flag for Product Knowledge hooks.

ALTER TABLE public.digital_asset_company_logos
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.digital_asset_company_logos.hashtags IS
  '3–5 brand hashtags for carousel captions. Empty means the model/soft-heal may supply tags.';

ALTER TABLE public.digital_asset_company_logos
  DROP CONSTRAINT IF EXISTS digital_asset_company_logos_hashtags_len;

ALTER TABLE public.digital_asset_company_logos
  ADD CONSTRAINT digital_asset_company_logos_hashtags_len
  CHECK (cardinality(hashtags) = 0 OR (cardinality(hashtags) BETWEEN 3 AND 5));

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS use_system_hooks boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ai_employee_briefs.use_system_hooks IS
  'When true, SOP1 Hook headline uses a Product Knowledge hook template (placeholders filled by the model). Visual hook stays free.';

-- ---------------------------------------------------------------------------
-- Logo save: add p_hashtags
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_save(
  p_employee_id uuid,
  p_logo_id uuid,
  p_brand_name text,
  p_storage_path text,
  p_tagline text DEFAULT NULL,
  p_headline_font text DEFAULT NULL,
  p_body_font text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_default_contact text DEFAULT NULL,
  p_hashtags text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
  v_id uuid;
  v_name text;
  v_tagline text;
  v_headline text;
  v_body text;
  v_website text;
  v_contact text;
  v_tags text[] := '{}'::text[];
  v_path text := NULLIF(btrim(COALESCE(p_storage_path, '')), '');
  v_old text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  v_name := NULLIF(left(btrim(COALESCE(p_brand_name, '')), 80), '');
  v_tagline := NULLIF(left(btrim(COALESCE(p_tagline, '')), 120), '');
  v_headline := NULLIF(left(btrim(COALESCE(p_headline_font, '')), 60), '');
  v_body := NULLIF(left(btrim(COALESCE(p_body_font, '')), 60), '');
  v_website := NULLIF(left(btrim(COALESCE(p_website_url, '')), 200), '');
  v_contact := NULLIF(left(btrim(COALESCE(p_default_contact, '')), 80), '');

  IF v_headline IS NOT NULL AND v_headline NOT IN (
    'Montserrat', 'Poppins', 'Open Sans', 'Lato', 'Roboto', 'Nunito', 'Raleway',
    'Oswald', 'Playfair Display', 'Source Sans 3', 'Inter', 'Merriweather', 'DM Sans', 'Bebas Neue'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_body IS NOT NULL AND v_body NOT IN (
    'Montserrat', 'Poppins', 'Open Sans', 'Lato', 'Roboto', 'Nunito', 'Raleway',
    'Oswald', 'Playfair Display', 'Source Sans 3', 'Inter', 'Merriweather', 'DM Sans', 'Bebas Neue'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_website IS NOT NULL THEN
    IF v_website ~* '[\s<>"''`]' OR v_website ~* '^(javascript|data):' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_website !~* '^https?://' THEN
      IF v_website !~* '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(/.*)?$' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_website := 'https://' || v_website;
    ELSIF v_website !~* '^https?://[^\s/$.?#].[^\s]*$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_website := left(v_website, 200);
  END IF;

  IF v_contact IS NOT NULL THEN
    IF v_contact ~* '[<>"''`]' OR v_contact ~* '^(javascript|data):' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_contact !~* '^https?://'
       AND v_contact !~* '^wa\.me/'
       AND v_contact !~* '^[+0-9][+0-9[:space:].()-]{6,78}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_hashtags IS NOT NULL THEN
    SELECT COALESCE(array_agg(picked.tag ORDER BY picked.ord), '{}'::text[])
      INTO v_tags
    FROM (
      SELECT normalized.tag, min(normalized.ord) AS ord
      FROM (
        SELECT
          left(
            CASE
              WHEN left(btrim(raw), 1) = '#' THEN btrim(raw)
              ELSE '#' || btrim(raw)
            END,
            48
          ) AS tag,
          ord
        FROM unnest(p_hashtags) WITH ORDINALITY AS item(raw, ord)
        WHERE NULLIF(btrim(raw), '') IS NOT NULL
      ) AS normalized
      WHERE normalized.tag ~ '^#[A-Za-z0-9_]+$'
      GROUP BY normalized.tag
    ) AS picked;

    IF cardinality(v_tags) NOT IN (0, 3, 4, 5) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_path IS NOT NULL AND v_path !~ (
    '^' || v_org::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_path IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM storage.objects object
    WHERE object.bucket_id = 'digital-asset-company-logos'
      AND object.name = v_path
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_logo_id IS NULL THEN
    IF v_path IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.digital_asset_company_logos (
      organization_id, service_id, brand_name, logo_path, tagline, headline_font, body_font,
      website_url, default_contact, hashtags
    ) VALUES (
      v_org, v_service, v_name, v_path, v_tagline, v_headline, v_body,
      v_website, v_contact, v_tags
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT logo.logo_path
    INTO v_old
    FROM public.digital_asset_company_logos logo
    WHERE logo.id = p_logo_id
      AND logo.organization_id = v_org
      AND logo.service_id = v_service;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.digital_asset_company_logos logo
    SET brand_name = v_name,
        logo_path = COALESCE(v_path, logo.logo_path),
        tagline = v_tagline,
        headline_font = v_headline,
        body_font = v_body,
        website_url = v_website,
        default_contact = v_contact,
        hashtags = CASE WHEN p_hashtags IS NULL THEN logo.hashtags ELSE v_tags END,
        updated_at = now()
    WHERE logo.id = p_logo_id
    RETURNING logo.id INTO v_id;
    IF v_path IS NOT NULL AND v_old IS NOT NULL AND v_old IS DISTINCT FROM v_path THEN
      DELETE FROM storage.objects object
      WHERE object.bucket_id = 'digital-asset-company-logos'
        AND object.name = v_old;
    END IF;
  END IF;

  UPDATE public.ai_employee_briefs brief
  SET company_logo_id = v_id,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text, text[]) FROM PUBLIC, anon, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text, text[]) IS
  'Owner menyimpan logo + tagline + font + website + kontak + hashtags katalog dan menjadikannya pilihan aktif.';

-- ---------------------------------------------------------------------------
-- brief_payload: company_logos.hashtags + use_system_hooks
-- ---------------------------------------------------------------------------
DO $payload$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure);
  old_logos text := $old$        'website_url', left(btrim(COALESCE(logo.website_url, '')), 200),
        'default_contact', left(btrim(COALESCE(logo.default_contact, '')), 80),
        'logo_path', logo.logo_path$old$;
  new_logos text := $new$        'website_url', left(btrim(COALESCE(logo.website_url, '')), 200),
        'default_contact', left(btrim(COALESCE(logo.default_contact, '')), 80),
        'hashtags', to_jsonb(COALESCE(logo.hashtags, '{}'::text[])),
        'logo_path', logo.logo_path$new$;
  old_voices text := $old$'repeat_voices', to_jsonb(v_row.repeat_voices),$old$;
  new_voices text := $new$'repeat_voices', to_jsonb(v_row.repeat_voices),
    'use_system_hooks', COALESCE(v_row.use_system_hooks, true),$new$;
  old_empty_voices text := $old$'repeat_voices', '[]'::jsonb,$old$;
  new_empty_voices text := $new$'repeat_voices', '[]'::jsonb,
      'use_system_hooks', true,$new$;
BEGIN
  IF position('''hashtags'', to_jsonb(COALESCE(logo.hashtags' IN def) > 0
     AND position('''use_system_hooks'', COALESCE(v_row.use_system_hooks' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_logos IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_payload_logo_hashtags_snippet_missing';
  END IF;
  def := replace(def, old_logos, new_logos);
  IF position('''use_system_hooks'', COALESCE(v_row.use_system_hooks' IN def) = 0 THEN
    IF position(old_voices IN def) = 0 THEN
      RAISE EXCEPTION 'ai_employee_brief_payload_hooks_flag_snippet_missing';
    END IF;
    def := replace(def, old_voices, new_voices);
  END IF;
  IF position(old_empty_voices IN def) > 0 AND position('''use_system_hooks'', true' IN def) = 0 THEN
    def := replace(def, old_empty_voices, new_empty_voices);
  END IF;
  EXECUTE def;
END;
$payload$;

-- ---------------------------------------------------------------------------
-- brief_write: optional use_system_hooks from payload
-- ---------------------------------------------------------------------------
DO $write$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure);
  old_declare text := 'v_sub uuid; v_subs uuid[]; v_auto boolean; v_has_sub boolean; v_has_auto boolean;';
  new_declare text := 'v_sub uuid; v_subs uuid[]; v_auto boolean; v_hooks boolean; v_has_sub boolean; v_has_auto boolean; v_has_hooks boolean;';
  old_parse_tail text := $old$IF v_has_auto AND v_auto IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;$old$;
  new_parse_tail text := $new$IF v_has_auto AND v_auto IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_has_hooks := p_brief ? 'use_system_hooks';
  v_hooks := CASE
    WHEN NOT v_has_hooks THEN true
    WHEN jsonb_typeof(p_brief->'use_system_hooks') = 'boolean' THEN (p_brief->>'use_system_hooks')::boolean
    ELSE NULL
  END;
  IF v_has_hooks AND v_hooks IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;$new$;
  old_insert text := 'split_rule, sub_service_id, sub_service_ids, content_plan_auto_approve, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, v_subs, COALESCE(v_auto, false), now())';
  new_insert text := 'split_rule, sub_service_id, sub_service_ids, content_plan_auto_approve, use_system_hooks, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, v_subs, COALESCE(v_auto, false), COALESCE(v_hooks, true), now())';
  old_conflict text := $old$content_plan_auto_approve = CASE
        WHEN v_has_auto THEN EXCLUDED.content_plan_auto_approve
        ELSE ai_employee_briefs.content_plan_auto_approve
      END,$old$;
  new_conflict text := $new$content_plan_auto_approve = CASE
        WHEN v_has_auto THEN EXCLUDED.content_plan_auto_approve
        ELSE ai_employee_briefs.content_plan_auto_approve
      END,
      use_system_hooks = CASE
        WHEN v_has_hooks THEN EXCLUDED.use_system_hooks
        ELSE ai_employee_briefs.use_system_hooks
      END,$new$;
BEGIN
  IF position('v_has_hooks boolean' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_declare IN def) = 0
    OR position(old_parse_tail IN def) = 0
    OR position(old_insert IN def) = 0
    OR position(old_conflict IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_write_hooks_flag_snippet_missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_parse_tail, new_parse_tail);
  def := replace(def, old_insert, new_insert);
  def := replace(def, old_conflict, new_conflict);
  EXECUTE def;
END;
$write$;
