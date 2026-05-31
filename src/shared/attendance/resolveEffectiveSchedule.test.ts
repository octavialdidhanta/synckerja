import { describe, expect, it } from 'vitest';
import { parseAttendanceValidationRow } from './resolveEffectiveSchedule';

describe('parseAttendanceValidationRow', () => {
  it('parses RPC row array with shift audit fields', () => {
    const parsed = parseAttendanceValidationRow([
      {
        allowed_radius: 100,
        can_attend: true,
        distance_meters: 12,
        face_registered: true,
        face_valid: true,
        is_holiday: false,
        is_late: true,
        late_minutes: 20,
        location_valid: true,
        no_duplicate: true,
        office_location_id: 'office-1',
        office_location_name: 'HQ',
        schedule_valid: true,
        shift_id: 'shift-1',
        employee_shift_id: 'es-1',
        work_schedule_id: 'wss-1',
        schedule_source: 'shift',
        start_time: '08:00',
        working_days: [1, 2, 3, 4, 5],
      },
    ]);

    expect(parsed?.shift_id).toBe('shift-1');
    expect(parsed?.schedule_source).toBe('shift');
    expect(parsed?.late_minutes).toBe(20);
  });

  it('returns null for invalid payload', () => {
    expect(parseAttendanceValidationRow(null)).toBeNull();
    expect(parseAttendanceValidationRow([])).toBeNull();
  });
});

describe('assignment overlap (client mirror)', () => {
  function rangesOverlap(
    fromA: string,
    toA: string | null,
    fromB: string,
    toB: string | null,
  ): boolean {
    const endA = toA ?? '9999-12-31';
    const endB = toB ?? '9999-12-31';
    return fromA <= endB && fromB <= endA;
  }

  it('detects overlapping open-ended ranges', () => {
    expect(rangesOverlap('2026-01-01', null, '2026-06-01', '2026-06-30')).toBe(true);
    expect(rangesOverlap('2026-01-01', '2026-05-31', '2026-06-01', '2026-06-30')).toBe(false);
  });
});
