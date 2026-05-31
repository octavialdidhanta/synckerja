import { supabase } from '@/shared/lib/supabaseClient';

export type EffectiveScheduleSource = 'shift' | 'work_schedule';

export interface EffectiveSchedule {
  source: EffectiveScheduleSource;
  shift_id: string | null;
  employee_shift_id: string | null;
  work_schedule_id: string | null;
  schedule_name: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  overtime_threshold_minutes: number;
  break_duration_minutes: number;
  timezone: string;
  working_days: number[];
  is_working_day: boolean;
}

export interface AttendanceValidationRpcRow {
  allowed_radius: number;
  can_attend: boolean;
  distance_meters: number;
  face_registered: boolean;
  face_valid: boolean;
  is_holiday: boolean;
  is_late: boolean;
  late_minutes: number;
  location_valid: boolean;
  no_duplicate: boolean;
  office_location_id: string | null;
  office_location_name: string | null;
  schedule_valid: boolean;
  shift_id: string | null;
  employee_shift_id: string | null;
  work_schedule_id: string | null;
  schedule_source: EffectiveScheduleSource | null;
  start_time: string | null;
  working_days: number[] | null;
  gps_accuracy_valid?: boolean;
  photo_required?: boolean;
  attendance_rules_snapshot?: Record<string, unknown> | null;
  visit_day_mode?: string | null;
  late_reference_time?: string | null;
}

export interface CheckoutValidationRpcRow {
  can_checkout: boolean;
  photo_required: boolean;
  photo_valid: boolean;
  has_checkin: boolean;
  already_checked_out: boolean;
}

export async function resolveEffectiveSchedule(
  employeeId: string,
  organizationId: string,
  effectiveDate: string,
): Promise<EffectiveSchedule | null> {
  const { data, error } = await supabase.rpc('resolve_effective_schedule', {
    p_employee_id: employeeId,
    p_organization_id: organizationId,
    p_effective_date: effectiveDate,
  });

  if (error) {
    console.error('resolve_effective_schedule error:', error);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row || typeof row.start_time !== 'string') {
    return null;
  }

  return {
    source: row.source === 'shift' ? 'shift' : 'work_schedule',
    shift_id: (row.shift_id as string | null) ?? null,
    employee_shift_id: (row.employee_shift_id as string | null) ?? null,
    work_schedule_id: (row.work_schedule_id as string | null) ?? null,
    schedule_name: (row.schedule_name as string) ?? 'Schedule',
    start_time: row.start_time,
    end_time: (row.end_time as string) ?? '17:00',
    late_tolerance_minutes: Number(row.late_tolerance_minutes ?? 0),
    overtime_threshold_minutes: Number(row.overtime_threshold_minutes ?? 0),
    break_duration_minutes: Number(row.break_duration_minutes ?? 0),
    timezone: (row.timezone as string) ?? 'Asia/Jakarta',
    working_days: (row.working_days as number[]) ?? [1, 2, 3, 4, 5],
    is_working_day: Boolean(row.is_working_day),
  };
}

export function parseAttendanceValidationRow(
  data: unknown,
): AttendanceValidationRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return null;
  }
  return row as AttendanceValidationRpcRow;
}

export function parseCheckoutValidationRow(data: unknown): CheckoutValidationRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return null;
  }
  return row as CheckoutValidationRpcRow;
}
