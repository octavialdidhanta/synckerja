import { supabase } from '@/shared/lib/supabaseClient';

export type StartClientVisitExecutionParams = {
  employeeId: string;
  organizationId: string;
  visitDateYmd: string;
  locationId: string;
  leadClientId: string;
  actualStartTime: string;
  startLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  startPhotoPath: string;
  createdBy: string;
  locationValidationResult?: unknown;
  validationAccuracyMeters?: number | null;
  notes?: string | null;
};

export type StartClientVisitExecutionErrorCode =
  | 'ACCESS_DENIED'
  | 'COMPLETED_VISIT_EXISTS'
  | 'SCHEDULED_VISIT_EXISTS'
  | 'SCHEDULED_UPDATE_FAILED'
  | 'ONGOING_VISIT_EXISTS'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN';

export type ClientVisitAttendanceSidecar = {
  skipped?: boolean;
  reason?: string;
  attendance_id?: string;
  attendance_auto_checkin?: boolean;
  visit_day_mode?: string;
  is_late?: boolean;
  late_minutes?: number;
  penalties_applied?: number;
};

export type StartClientVisitExecutionResult = {
  visit: Record<string, unknown>;
  visit_day_mode: string | null;
  attendance: ClientVisitAttendanceSidecar | null;
};

export function parseStartClientVisitExecutionError(message?: string | null): StartClientVisitExecutionErrorCode {
  const code = message?.trim().toUpperCase() ?? '';
  if (code.includes('ACCESS_DENIED')) return 'ACCESS_DENIED';
  if (code.includes('COMPLETED_VISIT_EXISTS')) return 'COMPLETED_VISIT_EXISTS';
  if (code.includes('SCHEDULED_VISIT_EXISTS')) return 'SCHEDULED_VISIT_EXISTS';
  if (code.includes('SCHEDULED_UPDATE_FAILED')) return 'SCHEDULED_UPDATE_FAILED';
  if (code.includes('ONGOING_VISIT_EXISTS')) return 'ONGOING_VISIT_EXISTS';
  if (code.includes('INVALID_ARGUMENT')) return 'INVALID_ARGUMENT';
  return 'UNKNOWN';
}

function parseStartClientVisitExecutionResult(data: unknown): StartClientVisitExecutionResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid start visit response');
  }

  const row = data as Record<string, unknown>;

  if (row.visit && typeof row.visit === 'object') {
    return {
      visit: row.visit as Record<string, unknown>,
      visit_day_mode: typeof row.visit_day_mode === 'string' ? row.visit_day_mode : null,
      attendance:
        row.attendance && typeof row.attendance === 'object'
          ? (row.attendance as ClientVisitAttendanceSidecar)
          : null,
    };
  }

  return {
    visit: row,
    visit_day_mode: null,
    attendance: null,
  };
}

export async function startClientVisitExecution(
  params: StartClientVisitExecutionParams,
): Promise<StartClientVisitExecutionResult> {
  const { data, error } = await supabase.rpc('start_client_visit_execution', {
    p_employee_id: params.employeeId,
    p_organization_id: params.organizationId,
    p_visit_date: params.visitDateYmd,
    p_location_id: params.locationId,
    p_lead_client_id: params.leadClientId,
    p_actual_start_time: params.actualStartTime,
    p_start_location: params.startLocation,
    p_start_photo_path: params.startPhotoPath,
    p_created_by: params.createdBy,
    p_location_validation_result: params.locationValidationResult ?? null,
    p_validation_accuracy_meters: params.validationAccuracyMeters ?? null,
    p_notes: params.notes ?? null,
  });

  if (error) {
    throw Object.assign(new Error(error.message), {
      code: parseStartClientVisitExecutionError(error.message),
    });
  }

  return parseStartClientVisitExecutionResult(data);
}
