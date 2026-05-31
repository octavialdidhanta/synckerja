import { describe, expect, it } from 'vitest';
import {
  enforceNationalHolidaysFromSnapshot,
  resolveCanAttendAfterClientFixes,
} from './resolveCanAttendAfterClientFixes';

const baseOk = {
  location_valid: true,
  face_valid: true,
  schedule_valid: true,
  no_duplicate: true,
  is_holiday: false,
  gps_accuracy_valid: true,
  photo_required: true,
  attendance_rules_snapshot: { enforce_national_holidays: true },
};

describe('resolveCanAttendAfterClientFixes', () => {
  it('allows when IP/face fixed and RPC hard rules pass', () => {
    expect(
      resolveCanAttendAfterClientFixes(baseOk, { hasPhoto: true }),
    ).toBe(true);
  });

  it('blocks when schedule invalid even if location fixed via IP', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        { ...baseOk, schedule_valid: false },
        { hasPhoto: true },
      ),
    ).toBe(false);
  });

  it('blocks on holiday when enforce_national_holidays is true', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        { ...baseOk, is_holiday: true },
        { hasPhoto: true },
      ),
    ).toBe(false);
  });

  it('allows holiday when enforce_national_holidays is false', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        {
          ...baseOk,
          is_holiday: true,
          attendance_rules_snapshot: { enforce_national_holidays: false },
        },
        { hasPhoto: true },
      ),
    ).toBe(true);
  });

  it('blocks when GPS accuracy invalid even if location fixed via IP', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        { ...baseOk, gps_accuracy_valid: false },
        { hasPhoto: true },
      ),
    ).toBe(false);
  });

  it('blocks when photo required but missing', () => {
    expect(
      resolveCanAttendAfterClientFixes(baseOk, { hasPhoto: false }),
    ).toBe(false);
  });

  it('blocks when face invalid even if location valid', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        { ...baseOk, face_valid: false },
        { hasPhoto: true },
      ),
    ).toBe(false);
  });

  it('blocks duplicate attendance', () => {
    expect(
      resolveCanAttendAfterClientFixes(
        { ...baseOk, no_duplicate: false },
        { hasPhoto: true },
      ),
    ).toBe(false);
  });
});

describe('enforceNationalHolidaysFromSnapshot', () => {
  it('defaults to true when snapshot missing', () => {
    expect(enforceNationalHolidaysFromSnapshot(null)).toBe(true);
    expect(enforceNationalHolidaysFromSnapshot(undefined)).toBe(true);
  });

  it('reads false from snapshot', () => {
    expect(
      enforceNationalHolidaysFromSnapshot({ enforce_national_holidays: false }),
    ).toBe(false);
  });
});
