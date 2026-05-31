import { describe, expect, it } from 'vitest';
import {
  evaluateAttendanceRules,
  evaluateCheckoutRules,
} from './attendanceRulesValidation';

const baseRules = {
  enforce_national_holidays: true,
  require_photo_checkin: false,
  require_gps_accuracy: false,
  gps_accuracy_threshold_meters: 50,
  allow_manual_location: false,
  default_max_radius_meters: 100,
};

describe('evaluateAttendanceRules', () => {
  it('blocks check-in on holiday when enforce_national_holidays is true', () => {
    const result = evaluateAttendanceRules({
      rules: baseRules,
      isHoliday: true,
      isWorkingDay: true,
      scheduleSource: 'work_schedule',
      hasActiveShiftAssignment: false,
      officeRadiusMeters: 100,
      distanceMeters: 10,
      hasOfficeLocation: true,
      gpsAccuracyMeters: 20,
      isManualLocation: false,
      faceImageProvided: true,
      hasDuplicateCheckIn: false,
      faceValid: true,
    });

    expect(result.holidayBlocks).toBe(true);
    expect(result.canAttend).toBe(false);
  });

  it('allows check-in on holiday when enforce_national_holidays is false', () => {
    const result = evaluateAttendanceRules({
      rules: { ...baseRules, enforce_national_holidays: false },
      isHoliday: true,
      isWorkingDay: true,
      scheduleSource: 'work_schedule',
      hasActiveShiftAssignment: false,
      officeRadiusMeters: 100,
      distanceMeters: 10,
      hasOfficeLocation: true,
      gpsAccuracyMeters: 20,
      isManualLocation: false,
      faceImageProvided: true,
      hasDuplicateCheckIn: false,
      faceValid: true,
    });

    expect(result.holidayBlocks).toBe(false);
    expect(result.canAttend).toBe(true);
  });

  it('shift override allows Saturday when WSS excludes weekend', () => {
    const result = evaluateAttendanceRules({
      rules: baseRules,
      isHoliday: false,
      isWorkingDay: false,
      scheduleSource: 'shift',
      hasActiveShiftAssignment: true,
      officeRadiusMeters: 100,
      distanceMeters: 10,
      hasOfficeLocation: true,
      gpsAccuracyMeters: 20,
      isManualLocation: false,
      faceImageProvided: true,
      hasDuplicateCheckIn: false,
      faceValid: true,
    });

    expect(result.scheduleValid).toBe(true);
    expect(result.canAttend).toBe(true);
  });

  it('uses org fallback radius 100 when office radius is null', () => {
    const result = evaluateAttendanceRules({
      rules: baseRules,
      isHoliday: false,
      isWorkingDay: true,
      scheduleSource: 'work_schedule',
      hasActiveShiftAssignment: false,
      officeRadiusMeters: null,
      distanceMeters: 90,
      hasOfficeLocation: true,
      gpsAccuracyMeters: 20,
      isManualLocation: false,
      faceImageProvided: true,
      hasDuplicateCheckIn: false,
      faceValid: true,
    });

    expect(result.allowedRadius).toBe(100);
    expect(result.locationValid).toBe(true);
  });

  it('blocks when GPS accuracy exceeds threshold and required', () => {
    const result = evaluateAttendanceRules({
      rules: { ...baseRules, require_gps_accuracy: true },
      isHoliday: false,
      isWorkingDay: true,
      scheduleSource: 'work_schedule',
      hasActiveShiftAssignment: false,
      officeRadiusMeters: 100,
      distanceMeters: 10,
      hasOfficeLocation: true,
      gpsAccuracyMeters: 80,
      isManualLocation: false,
      faceImageProvided: true,
      hasDuplicateCheckIn: false,
      faceValid: true,
    });

    expect(result.gpsAccuracyValid).toBe(false);
    expect(result.canAttend).toBe(false);
  });
});

describe('evaluateCheckoutRules', () => {
  it('requires photo on checkout when enabled', () => {
    const result = evaluateCheckoutRules({
      requirePhotoCheckout: true,
      photoPathProvided: false,
      faceImageProvided: false,
      hasCheckIn: true,
      alreadyCheckedOut: false,
    });

    expect(result.photoRequired).toBe(true);
    expect(result.canCheckout).toBe(false);
  });
});
