import { useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { dateToPostgresTimeUtc } from '@/1-home/utils/attendanceDateTime';
import {
  parseAttendanceValidationRow,
  parseCheckoutValidationRow,
  type AttendanceValidationRpcRow,
} from '@/shared/attendance/resolveEffectiveSchedule';
import { toast } from 'sonner';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { uploadAttendancePhoto } from '@/shared/lib/attendance/uploadAttendancePhoto';

interface AttendanceData {
  latitude: number;
  longitude: number;
  photoUrl?: string;
  gpsAccuracyMeters?: number | null;
  isManualLocation?: boolean;
  faceImageData?: string | null;
}

type ValidationResult = AttendanceValidationRpcRow;

function calculateWorkingMinutes(checkInTime: string, checkOutTime: Date): number {
  const checkIn = new Date(checkInTime);
  if (Number.isNaN(checkIn.getTime())) return 0;
  return Math.max(0, Math.floor((checkOutTime.getTime() - checkIn.getTime()) / (1000 * 60)));
}

async function resolveAttendancePhotoPath(
  employeeId: string,
  attendanceData: AttendanceData,
  type: 'check_in' | 'check_out',
): Promise<string | null> {
  if (attendanceData.faceImageData?.trim()) {
    const uploaded = await uploadAttendancePhoto(employeeId, attendanceData.faceImageData, type);
    return uploaded.path;
  }
  if (attendanceData.photoUrl?.trim()) {
    return attendanceData.photoUrl;
  }
  return null;
}

function formatLocalCheckinTimeString(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0') +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0') +
    ':' +
    String(d.getSeconds()).padStart(2, '0')
  );
}

export const useAttendanceOperations = () => {
  const [loading, setLoading] = useState(false);
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();

  const validateAttendance = async (
    latitude: number,
    longitude: number,
    options?: {
      faceImageData?: string | null;
      gpsAccuracyMeters?: number | null;
      isManualLocation?: boolean;
    },
  ) => {
    if (!currentEmployee?.id || !organizationId) {
      console.error('Missing employee or organization:', { 
        employeeId: currentEmployee?.id, 
        organizationId 
      });
      toast.error('Employee or organization not found');
      return null;
    }

    console.log('🔍 Starting attendance validation:', {
      employeeId: currentEmployee.id,
      organizationId,
      latitude,
      longitude,
      currentDay: new Date().getDay(),
      currentTime: new Date().toLocaleString()
    });

    try {
      // Use the comprehensive validation function
      const { data, error } = await supabase.rpc('validate_attendance_comprehensive', {
        employee_id_param: currentEmployee.id,
        organization_id_param: organizationId,
        latitude_param: latitude,
        longitude_param: longitude,
        face_image_data: options?.faceImageData ?? null,
        gps_accuracy_meters: options?.gpsAccuracyMeters ?? null,
        is_manual_location: options?.isManualLocation ?? false,
      });

      if (error) {
        console.error('❌ Validation error:', error);
        toast.error('Failed to validate attendance: ' + error.message);
        return null;
      }

      if (!data) {
        console.error('❌ No validation data returned');
        toast.error('No validation data received');
        return null;
      }

      console.log('✅ Raw validation result:', data);

      const validationResult = parseAttendanceValidationRow(data);
      if (!validationResult) {
        toast.error('Invalid validation response format');
        return null;
      }

      console.log('✅ Parsed validation result:', validationResult);

      return validationResult;
    } catch (error) {
      console.error('❌ Validation request failed:', error);
      toast.error('Validation failed: ' + (error as Error).message);
      return null;
    }
  };

  const checkIn = async (attendanceData: AttendanceData) => {
    if (!currentEmployee?.id || !organizationId) {
      toast.error('Employee or organization not found');
      return false;
    }

    setLoading(true);
    try {
      let photoPath: string | null = null;
      try {
        photoPath = await resolveAttendancePhotoPath(currentEmployee.id, attendanceData, 'check_in');
      } catch (uploadError) {
        toast.error('Failed to upload check-in photo: ' + (uploadError as Error).message);
        return false;
      }

      const validation = await validateAttendance(
        attendanceData.latitude,
        attendanceData.longitude,
        {
          faceImageData: attendanceData.faceImageData ?? null,
          gpsAccuracyMeters: attendanceData.gpsAccuracyMeters ?? null,
          isManualLocation: attendanceData.isManualLocation ?? false,
        },
      );
      
      if (!validation) {
        toast.error('Failed to validate attendance');
        return false;
      }
      
      if (!validation.can_attend) {
        let errorMessage = 'Cannot check in: ';
        if (validation.photo_required && !validation.can_attend) {
          errorMessage += 'Photo required for check-in. ';
        }
        if (validation.gps_accuracy_valid === false) errorMessage += 'GPS accuracy too low. ';
        if (!validation.location_valid) errorMessage += 'Outside office location. ';
        if (!validation.no_duplicate) errorMessage += 'Already checked in today. ';
        if (validation.is_holiday) errorMessage += 'Today is a holiday. ';
        if (!validation.schedule_valid) errorMessage += 'Not a working day or outside schedule. ';
        
        toast.error(errorMessage.trim());
        return false;
      }

      const currentTime = new Date();
      const localCheckinTime = formatLocalCheckinTimeString(currentTime);

      const { data: recordResult, error } = await supabase.rpc('record_attendance_with_timezone', {
        employee_id_param: currentEmployee.id,
        organization_id_param: organizationId,
        local_checkin_time: localCheckinTime,
        latitude_param: attendanceData.latitude,
        longitude_param: attendanceData.longitude,
        timezone_param: 'Asia/Jakarta',
        photo_path_param: photoPath,
        location_data: {
          latitude: attendanceData.latitude,
          longitude: attendanceData.longitude,
        },
        notes_param: null,
      });

      if (error) {
        console.error('❌ Check-in error:', error);
        toast.error('Failed to check in: ' + error.message);
        return false;
      }

      const record = Array.isArray(recordResult) ? recordResult[0] : recordResult;

      console.log('✅ Check-in successful:', {
        record,
        is_late: validation.is_late,
        late_minutes: validation.late_minutes,
        shift_id: validation.shift_id,
        work_schedule_id: validation.work_schedule_id,
      });

      if (validation.is_late) {
        toast.warning(`Check-in successful, but you are ${validation.late_minutes} minutes late`);
      } else {
        toast.success('Check-in successful!');
      }

      return true;
    } catch (error) {
      console.error('❌ Check-in failed:', error);
      toast.error('Check-in failed: ' + (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkOut = async (attendanceData: AttendanceData) => {
    if (!currentEmployee?.id || !organizationId) {
      toast.error('Employee or organization not found');
      return false;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's attendance record
      const { data: existingRecord, error: fetchError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .eq('organization_id', organizationId)
        .eq('attendance_date', today)
        .eq('status', 'present')
        .is('check_out_time', null)
        .single();

      if (fetchError || !existingRecord) {
        toast.error('No active check-in found for today');
        return false;
      }

      let photoPath: string | null = null;
      try {
        photoPath = await resolveAttendancePhotoPath(currentEmployee.id, attendanceData, 'check_out');
      } catch (uploadError) {
        toast.error('Failed to upload check-out photo: ' + (uploadError as Error).message);
        return false;
      }

      const { data: checkoutValidationRaw, error: checkoutValidationError } = await supabase.rpc(
        'validate_checkout_comprehensive',
        {
          employee_id_param: currentEmployee.id,
          organization_id_param: organizationId,
          photo_path_param: photoPath,
          face_image_data: attendanceData.faceImageData ?? null,
        },
      );

      if (checkoutValidationError) {
        toast.error('Failed to validate check-out: ' + checkoutValidationError.message);
        return false;
      }

      const checkoutValidation = parseCheckoutValidationRow(checkoutValidationRaw);
      if (!checkoutValidation?.can_checkout) {
        let msg = 'Cannot check out: ';
        if (!checkoutValidation?.has_checkin) msg += 'No check-in found. ';
        if (checkoutValidation?.already_checked_out) msg += 'Already checked out. ';
        if (checkoutValidation?.photo_required && !checkoutValidation.photo_valid) {
          msg += 'Photo required for check-out. ';
        }
        toast.error(msg.trim());
        return false;
      }

      const currentTime = new Date();
      const workingHours = calculateWorkingMinutes(existingRecord.check_in_time, currentTime);

      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: dateToPostgresTimeUtc(currentTime),
          check_out_location: {
            latitude: attendanceData.latitude,
            longitude: attendanceData.longitude
          },
          check_out_photo_path: photoPath,
          working_hours_minutes: workingHours,
          updated_at: currentTime.toISOString()
        })
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error('❌ Check-out error:', updateError);
        toast.error('Failed to check out: ' + updateError.message);
        return false;
      }

      const hours = Math.floor(workingHours / 60);
      const minutes = workingHours % 60;
      toast.success(`Check-out successful! Worked ${hours}h ${minutes}m today`);
      
      return true;
    } catch (error) {
      console.error('❌ Check-out failed:', error);
      toast.error('Check-out failed: ' + (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkIn,
    checkOut,
    validateAttendance,
    loading
  };
};
