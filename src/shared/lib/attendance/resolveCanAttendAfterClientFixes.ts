export interface ClientFixValidationInput {
  location_valid: boolean;
  face_valid: boolean;
  schedule_valid: boolean;
  no_duplicate: boolean;
  is_holiday: boolean;
  gps_accuracy_valid?: boolean;
  photo_required?: boolean;
  attendance_rules_snapshot?: Record<string, unknown> | null;
}

export interface ResolveCanAttendOptions {
  hasPhoto: boolean;
}

/** RPC-authoritative gate after optional client IP/face fixes only. */
export function resolveCanAttendAfterClientFixes(
  validation: ClientFixValidationInput,
  options: ResolveCanAttendOptions,
): boolean {
  const enforceNationalHolidays =
    validation.attendance_rules_snapshot?.enforce_national_holidays ?? true;
  const holidayBlocks = validation.is_holiday && enforceNationalHolidays;

  const rpcHardBlocks =
    !validation.no_duplicate ||
    validation.gps_accuracy_valid === false ||
    (validation.photo_required === true && !options.hasPhoto) ||
    !validation.schedule_valid ||
    holidayBlocks;

  if (rpcHardBlocks) return false;

  return validation.location_valid && validation.face_valid;
}

export function enforceNationalHolidaysFromSnapshot(
  snapshot?: Record<string, unknown> | null,
): boolean {
  if (snapshot == null) return true;
  const value = snapshot.enforce_national_holidays;
  if (typeof value === 'boolean') return value;
  return true;
}
