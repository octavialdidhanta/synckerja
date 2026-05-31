import type { AttendanceRulesSettingsRow } from '@/2-3-settings/hooks/useAttendanceRulesSettings';

export interface AttendanceRulesValidationInput {
  rules: Pick<
    AttendanceRulesSettingsRow,
    | 'enforce_national_holidays'
    | 'require_photo_checkin'
    | 'require_gps_accuracy'
    | 'gps_accuracy_threshold_meters'
    | 'allow_manual_location'
    | 'default_max_radius_meters'
  >;
  isHoliday: boolean;
  isWorkingDay: boolean;
  scheduleSource: 'shift' | 'work_schedule' | null;
  hasActiveShiftAssignment: boolean;
  officeRadiusMeters: number | null;
  distanceMeters: number | null;
  hasOfficeLocation: boolean;
  gpsAccuracyMeters: number | null;
  isManualLocation: boolean;
  faceImageProvided: boolean;
  hasDuplicateCheckIn: boolean;
  faceValid: boolean;
}

export interface AttendanceRulesValidationResult {
  scheduleValid: boolean;
  holidayBlocks: boolean;
  locationValid: boolean;
  gpsAccuracyValid: boolean;
  manualLocationValid: boolean;
  photoValid: boolean;
  photoRequired: boolean;
  allowedRadius: number;
  canAttend: boolean;
}

export function evaluateAttendanceRules(
  input: AttendanceRulesValidationInput,
): AttendanceRulesValidationResult {
  let scheduleValid = input.isWorkingDay;
  if (
    !scheduleValid &&
    input.scheduleSource === 'shift' &&
    input.hasActiveShiftAssignment
  ) {
    scheduleValid = true;
  }

  const holidayBlocks = input.isHoliday && input.rules.enforce_national_holidays;

  const allowedRadius = input.officeRadiusMeters ?? input.rules.default_max_radius_meters ?? 100;
  const locationValid =
    input.hasOfficeLocation &&
    input.distanceMeters != null &&
    input.distanceMeters <= allowedRadius;

  let gpsAccuracyValid = true;
  if (input.rules.require_gps_accuracy) {
    gpsAccuracyValid =
      input.gpsAccuracyMeters != null &&
      input.gpsAccuracyMeters <= input.rules.gps_accuracy_threshold_meters;
  }

  const manualLocationValid =
    !input.isManualLocation || input.rules.allow_manual_location;

  const photoRequired = input.rules.require_photo_checkin;
  const photoValid = !photoRequired || input.faceImageProvided;

  const canAttend =
    locationValid &&
    scheduleValid &&
    !holidayBlocks &&
    !input.hasDuplicateCheckIn &&
    input.faceValid &&
    gpsAccuracyValid &&
    manualLocationValid &&
    photoValid;

  return {
    scheduleValid,
    holidayBlocks,
    locationValid,
    gpsAccuracyValid,
    manualLocationValid,
    photoValid,
    photoRequired,
    allowedRadius,
    canAttend,
  };
}

export interface CheckoutRulesInput {
  requirePhotoCheckout: boolean;
  photoPathProvided: boolean;
  faceImageProvided: boolean;
  hasCheckIn: boolean;
  alreadyCheckedOut: boolean;
}

export function evaluateCheckoutRules(input: CheckoutRulesInput): {
  canCheckout: boolean;
  photoRequired: boolean;
  photoValid: boolean;
} {
  const photoRequired = input.requirePhotoCheckout;
  const photoValid =
    !photoRequired || input.photoPathProvided || input.faceImageProvided;

  return {
    canCheckout: input.hasCheckIn && !input.alreadyCheckedOut && photoValid,
    photoRequired,
    photoValid,
  };
}
