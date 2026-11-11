-- Catalog logos are identified by the saved catalog, so brand_name may be empty.

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_save(
  p_employee_id uuid,
  p_logo_id uuid,
  p_brand_name text,
  p_storage_path text
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
  v_path text := NULLIF(btrim(COALESCE(p_storage_path, '')), '');
  v_old text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  v_name := NULLIF(left(btrim(COALESCE(p_brand_name, '')), 80), '');
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
      organization_id, service_id, brand_name, logo_path
    ) VALUES (
      v_org, v_service, v_name, v_path
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
