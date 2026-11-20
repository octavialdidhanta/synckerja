-- Atomic start visit: UPDATE existing scheduled row (preserve purpose/plan times),
-- never INSERT duplicate when a scheduled visit exists for the same client/day.

CREATE OR REPLACE FUNCTION public.start_client_visit_execution(
  p_employee_id uuid,
  p_organization_id uuid,
  p_visit_date date,
  p_location_id uuid,
  p_lead_client_id uuid,
  p_actual_start_time timestamptz,
  p_start_location jsonb,
  p_start_photo_path text,
  p_created_by uuid,
  p_location_validation_result jsonb DEFAULT NULL,
  p_validation_accuracy_meters numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.client_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_client_id uuid;
  v_scheduled public.client_visits%ROWTYPE;
  v_result public.client_visits%ROWTYPE;
BEGIN
  IF p_employee_id IS NULL OR p_organization_id IS NULL OR p_visit_date IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT ol.client_id
  INTO v_location_client_id
  FROM public.office_locations ol
  WHERE ol.id = p_location_id
    AND ol.organization_id = p_organization_id;

  IF EXISTS (
    SELECT 1
    FROM public.client_visits cv
    WHERE cv.employee_id = p_employee_id
      AND cv.organization_id = p_organization_id
      AND cv.visit_date = p_visit_date
      AND cv.status = 'completed'
      AND cv.actual_start_time IS NOT NULL
      AND cv.actual_end_time IS NOT NULL
      AND (
        cv.validated_location_id = p_location_id
        OR (
          v_location_client_id IS NOT NULL
          AND cv.lead_client_id = v_location_client_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'COMPLETED_VISIT_EXISTS';
  END IF;

  SELECT cv.*
  INTO v_scheduled
  FROM public.client_visits cv
  WHERE cv.employee_id = p_employee_id
    AND cv.organization_id = p_organization_id
    AND cv.visit_date = p_visit_date
    AND cv.status = 'scheduled'
    AND (
      cv.validated_location_id = p_location_id
      OR (
        v_location_client_id IS NOT NULL
        AND cv.lead_client_id = v_location_client_id
      )
      OR (
        p_lead_client_id IS NOT NULL
        AND cv.lead_client_id = p_lead_client_id
      )
    )
  ORDER BY
    CASE WHEN cv.validated_location_id = p_location_id THEN 0 ELSE 1 END,
    cv.planned_start_time NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_scheduled.id IS NOT NULL THEN
    UPDATE public.client_visits
    SET
      actual_start_time = p_actual_start_time,
      start_location = p_start_location,
      status = 'ongoing',
      start_photo_path = p_start_photo_path,
      created_by = p_created_by,
      validated_location_id = p_location_id,
      location_validation_result = p_location_validation_result,
      validation_accuracy_meters = p_validation_accuracy_meters,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = v_scheduled.id
      AND status = 'scheduled'
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
      RAISE EXCEPTION 'SCHEDULED_UPDATE_FAILED';
    END IF;

    RETURN v_result;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_visits cv
    WHERE cv.employee_id = p_employee_id
      AND cv.organization_id = p_organization_id
      AND cv.visit_date = p_visit_date
      AND cv.status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'SCHEDULED_VISIT_EXISTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_visits cv
    WHERE cv.employee_id = p_employee_id
      AND cv.organization_id = p_organization_id
      AND cv.visit_date = p_visit_date
      AND cv.status = 'ongoing'
  ) THEN
    RAISE EXCEPTION 'ONGOING_VISIT_EXISTS';
  END IF;

  INSERT INTO public.client_visits (
    employee_id,
    organization_id,
    lead_client_id,
    visit_date,
    planned_start_time,
    planned_end_time,
    visit_purpose,
    actual_start_time,
    start_location,
    status,
    start_photo_path,
    created_by,
    validated_location_id,
    location_validation_result,
    validation_accuracy_meters,
    notes
  )
  VALUES (
    p_employee_id,
    p_organization_id,
    p_lead_client_id,
    p_visit_date,
    NULL,
    NULL,
    'Spontaneous client visit',
    p_actual_start_time,
    p_start_location,
    'ongoing',
    p_start_photo_path,
    p_created_by,
    p_location_id,
    p_location_validation_result,
    p_validation_accuracy_meters,
    p_notes
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.start_client_visit_execution(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, uuid, jsonb, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_client_visit_execution(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, uuid, jsonb, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.start_client_visit_execution IS
  'Mobile start visit: updates scheduled row for the day/client (keeps purpose & plan times), or inserts spontaneous visit only when no schedule exists.';
