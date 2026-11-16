-- Brand lockup hashtags: any count (not only 3–5).

ALTER TABLE public.digital_asset_company_logos
  DROP CONSTRAINT IF EXISTS digital_asset_company_logos_hashtags_len;

COMMENT ON COLUMN public.digital_asset_company_logos.hashtags IS
  'Brand hashtags for carousel captions. Empty means the model/soft-heal may supply tags.';

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
      ORDER BY min(normalized.ord)
      LIMIT 30
    ) AS picked;

    IF cardinality(p_hashtags) > 0 AND cardinality(v_tags) = 0 THEN
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
