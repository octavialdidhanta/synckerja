import type { AttendanceValidationRpcRow } from '@/shared/attendance/resolveEffectiveSchedule';

type TranslateFn = (
  key: string,
  defaultValue: string,
  params?: Record<string, string>,
) => string;

export function isClientVisitCheckinDay(validation: Pick<AttendanceValidationRpcRow, 'visit_day_mode'>): boolean {
  return validation.visit_day_mode === 'field_first' || validation.visit_day_mode === 'travel_field';
}

export const CLIENT_VISIT_CHECKIN_MESSAGE_ID =
  'Hari ini absensi melalui Start Visit di lokasi client. Buka menu Client Visit dan mulai kunjungan di site client.';

/** Map validate_attendance_comprehensive failure to user-facing description (mobile/web). */
export function getCheckInValidationFailureMessage(
  validation: AttendanceValidationRpcRow,
  t: TranslateFn,
): string {
  if (isClientVisitCheckinDay(validation) && !validation.can_attend) {
    return t(
      'attendanceRules.visitIntegration.useClientVisitCheckin',
      CLIENT_VISIT_CHECKIN_MESSAGE_ID,
    );
  }
  if (validation.photo_required && !validation.can_attend) {
    return t(
      'mobileHome.photoCheckinRequired',
      'Foto wajib untuk check-in',
    );
  }
  if (validation.gps_accuracy_valid === false) {
    return t(
      'mobileHome.gpsAccuracyInvalid',
      'Akurasi GPS tidak memenuhi threshold',
    );
  }
  if (!validation.location_valid) {
    return t(
      'mobileHome.locationInvalidDesc',
      'Anda tidak berada dalam radius area kantor yang diizinkan',
    );
  }
  if (!validation.no_duplicate) {
    return t(
      'mobileHome.alreadyClockInDesc',
      'Anda sudah melakukan clock in hari ini',
    );
  }
  if (validation.is_holiday) {
    return t(
      'mobileHome.holidayDesc',
      'Hari ini adalah hari libur sesuai jadwal kerja',
    );
  }
  if (!validation.schedule_valid) {
    return t(
      'mobileHome.scheduleInvalid',
      'Hari ini bukan hari kerja atau di luar jadwal yang berlaku',
    );
  }
  return t(
    'mobileHome.saveError',
    'Terjadi kesalahan saat menyimpan data',
  );
}
