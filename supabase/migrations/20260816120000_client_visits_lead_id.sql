-- Bridge Lead Magnet / Leads Management to client visits without dropping
-- the required client_visits.lead_client_id -> clients FK.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_organization_id_lead_id_uidx
  ON public.clients (organization_id, lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.clients.lead_id IS
  'Optional CRM lead this client row represents (stub created when scheduling a visit from a lead).';

ALTER TABLE public.client_visits
  ADD COLUMN IF NOT EXISTS lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_visits_org_status_visit_date_lead
  ON public.client_visits (organization_id, status, visit_date)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.client_visits.lead_id IS
  'CRM lead attributed to this visit. Used by Lead Magnet offline visit metrics.';

-- Walk-in INSERT copies lead_id from the clients stub. Scheduled UPDATE leaves the column as-is.
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_client_id uuid;
  v_scheduled public.client_visits%ROWTYPE;
  v_result public.client_visits%ROWTYPE;
  v_is_spontaneous boolean := false;
  v_mode jsonb;
  v_mode_text text;
  v_attendance jsonb := NULL;
  v_tz text := 'Asia/Jakarta';
  v_lead_id uuid;
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

  SELECT COALESCE(wss.timezone, 'Asia/Jakarta')
  INTO v_tz
  FROM public.work_schedule_settings wss
  WHERE wss.organization_id = p_organization_id
    AND COALESCE(wss.is_active, true)
  ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
  LIMIT 1;

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
  ELSE
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

    v_is_spontaneous := true;

    SELECT c.lead_id
    INTO v_lead_id
    FROM public.clients c
    WHERE c.id = p_lead_client_id
      AND c.organization_id = p_organization_id;

    INSERT INTO public.client_visits (
      employee_id,
      organization_id,
      lead_client_id,
      lead_id,
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
      v_lead_id,
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
  END IF;

  v_mode := public.resolve_visit_day_mode(
    p_employee_id,
    p_organization_id,
    p_visit_date,
    p_location_id,
    v_is_spontaneous
  );
  v_mode_text := v_mode->>'mode';

  IF v_is_spontaneous OR v_mode_text IN ('field_first', 'travel_field') THEN
    v_attendance := public.record_attendance_from_client_visit(
      p_employee_id,
      p_organization_id,
      p_visit_date,
      v_result.id,
      p_location_id,
      p_actual_start_time,
      p_start_location,
      p_start_photo_path,
      v_tz,
      v_is_spontaneous,
      p_notes
    );
  END IF;

  RETURN jsonb_build_object(
    'visit', to_jsonb(v_result),
    'visit_day_mode', v_mode_text,
    'attendance', v_attendance
  );
END;
$$;

COMMENT ON FUNCTION public.start_client_visit_execution IS
  'Start client visit; walk-in INSERT copies clients.lead_id onto client_visits.lead_id.';
