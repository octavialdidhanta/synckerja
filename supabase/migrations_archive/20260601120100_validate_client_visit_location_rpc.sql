-- validate_client_visit_location — nearest active client-site within radius.
-- Called from mobile ClientVisit.tsx and ClientLocationValidator.tsx.

CREATE OR REPLACE FUNCTION public.validate_client_visit_location(
  user_latitude double precision,
  user_longitude double precision,
  client_id_param uuid DEFAULT NULL,
  organization_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := organization_id_param;
  v_best record;
  v_distance numeric;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'Organization ID is required'
    );
  END IF;

  IF NOT (v_org IN (SELECT public.user_organization_ids())) THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'Access denied for organization'
    );
  END IF;

  IF user_latitude IS NULL OR user_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'Coordinates are required'
    );
  END IF;

  SELECT
    ol.id,
    ol.name,
    ol.radius_meters,
    (
      6371000.0 * acos(
        LEAST(
          1.0,
          GREATEST(
            -1.0,
            cos(radians(ol.latitude::double precision))
            * cos(radians(user_latitude))
            * cos(radians(user_longitude) - radians(ol.longitude::double precision))
            + sin(radians(ol.latitude::double precision))
            * sin(radians(user_latitude))
          )
        )
      )
    ) AS distance_m
  INTO v_best
  FROM public.office_locations ol
  WHERE ol.organization_id = v_org
    AND ol.is_active IS NOT FALSE
    AND ol.is_client_location IS TRUE
    AND ol.latitude IS NOT NULL
    AND ol.longitude IS NOT NULL
    AND (client_id_param IS NULL OR ol.client_id = client_id_param OR ol.client_id IS NULL)
  ORDER BY (
    6371000.0 * acos(
      LEAST(
        1.0,
        GREATEST(
          -1.0,
          cos(radians(ol.latitude::double precision))
          * cos(radians(user_latitude))
          * cos(radians(user_longitude) - radians(ol.longitude::double precision))
          + sin(radians(ol.latitude::double precision))
          * sin(radians(user_latitude))
        )
      )
    )
  )
  LIMIT 1;

  IF v_best.id IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'No client visit location configured for this organization'
    );
  END IF;

  v_distance := round(v_best.distance_m::numeric, 1);

  IF v_distance > COALESCE(v_best.radius_meters, 100) THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'location_id', v_best.id,
      'location_name', v_best.name,
      'distance_meters', v_distance,
      'allowed_radius_meters', COALESCE(v_best.radius_meters, 100),
      'error', format('Outside allowed radius (%sm)', COALESCE(v_best.radius_meters, 100))
    );
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'location_id', v_best.id,
    'location_name', v_best.name,
    'location_type', 'client-site',
    'distance_meters', v_distance,
    'allowed_radius_meters', COALESCE(v_best.radius_meters, 100),
    'accuracy_meters', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_client_visit_location(double precision, double precision, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_client_visit_location(double precision, double precision, uuid, uuid) TO authenticated;
