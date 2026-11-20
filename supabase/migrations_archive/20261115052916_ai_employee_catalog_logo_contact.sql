-- Website + default contact ride with the catalog logo lockup (last carousel slide).

ALTER TABLE public.digital_asset_company_logos
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS default_contact text;

COMMENT ON COLUMN public.digital_asset_company_logos.website_url IS
  'Brand website URL for the closing carousel contact box. Empty is allowed.';
COMMENT ON COLUMN public.digital_asset_company_logos.default_contact IS
  'Default catalog contact (phone / WhatsApp / wa.me) for the closing carousel contact box. Empty is allowed.';

DROP FUNCTION IF EXISTS public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_save(
  p_employee_id uuid,
  p_logo_id uuid,
  p_brand_name text,
  p_storage_path text,
  p_tagline text DEFAULT NULL,
  p_headline_font text DEFAULT NULL,
  p_body_font text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_default_contact text DEFAULT NULL
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
      website_url, default_contact
    ) VALUES (
      v_org, v_service, v_name, v_path, v_tagline, v_headline, v_body,
      v_website, v_contact
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

REVOKE ALL ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text, text, text, text, text, text) IS
  'Owner menyimpan logo + tagline + font + website + kontak katalog dan menjadikannya pilihan aktif.';

DO $payload$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure);
  old_logos text := $old$    'company_logos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', logo.id,
        'brand_name', left(btrim(COALESCE(logo.brand_name, '')), 80),
        'tagline', left(btrim(COALESCE(logo.tagline, '')), 120),
        'headline_font', left(btrim(COALESCE(logo.headline_font, '')), 60),
        'body_font', left(btrim(COALESCE(logo.body_font, '')), 60),
        'logo_path', logo.logo_path
      ) ORDER BY logo.updated_at DESC)
      FROM public.digital_asset_company_logos logo
      WHERE cardinality(v_row.service_ids) = 1
        AND logo.organization_id = v_org
        AND logo.service_id = v_row.service_ids[1]
    ), '[]'::jsonb)$old$;
  new_logos text := $new$    'company_logos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', logo.id,
        'brand_name', left(btrim(COALESCE(logo.brand_name, '')), 80),
        'tagline', left(btrim(COALESCE(logo.tagline, '')), 120),
        'headline_font', left(btrim(COALESCE(logo.headline_font, '')), 60),
        'body_font', left(btrim(COALESCE(logo.body_font, '')), 60),
        'website_url', left(btrim(COALESCE(logo.website_url, '')), 200),
        'default_contact', left(btrim(COALESCE(logo.default_contact, '')), 80),
        'logo_path', logo.logo_path
      ) ORDER BY logo.updated_at DESC)
      FROM public.digital_asset_company_logos logo
      WHERE cardinality(v_row.service_ids) = 1
        AND logo.organization_id = v_org
        AND logo.service_id = v_row.service_ids[1]
    ), '[]'::jsonb)$new$;
BEGIN
  IF position('''website_url'', left(btrim(COALESCE(logo.website_url' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_logos IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_payload_logo_contact_snippet_missing';
  END IF;
  def := replace(def, old_logos, new_logos);
  EXECUTE def;
END;
$payload$;
