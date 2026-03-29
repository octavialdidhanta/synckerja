
import { useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface AttendanceData {
  latitude: number;
  longitude: number;
  photoUrl?: string;
}

interface ValidationResult {
  location_valid: boolean;
  face_valid: boolean;
  schedule_valid: boolean;
  no_duplicate: boolean;
  is_holiday: boolean;
  is_late: boolean;
  late_minutes: number;
  office_location_id: string | null;
  office_location_name: string | null;
  distance_meters: number;
  allowed_radius: number;
  face_registered: boolean;
  can_attend: boolean;
  work_schedule_id: string | null;
  work_schedule_name: string | null;
  current_day: number;
  working_days: number[] | null;
  start_time: string | null;
  end_time: string | null;
  late_tolerance_minutes: number | null;
  employee_work_schedule_id: string | null;
  tolerance_end_time: string | null;
  debug_info?: {
    current_time: string;
    current_day: number;
    schedule_found: boolean;
    working_days_array: number[] | null;
    is_working_day: boolean;
    working_days_length: number | null;
    tolerance_calculation: string;
    late_calculation: string;
  };
}

export const useAttendanceOperations = () => {
  const [loading, setLoading] = useState(false);
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();

  const validateAttendance = async (latitude: number, longitude: number) => {
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
        face_image_data: null
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

      const row = Array.isArray(data) ? data[0] : data;
      
      // Safe type casting with proper error handling
      try {
        const validationResult = row as unknown as ValidationResult;
        
        // Validate that we have the expected structure
        if (typeof validationResult !== 'object' || validationResult === null) {
          throw new Error('Invalid validation result structure');
        }
        
        console.log('✅ Parsed validation result:', validationResult);
        console.log('🔍 Debug info:', validationResult.debug_info);
        
        return validationResult;
      } catch (castError) {
        console.error('❌ Error casting validation result:', castError);
        console.error('❌ Raw data structure:', typeof data, data);
        toast.error('Invalid validation response format');
        return null;
      }
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
      // Validate attendance first
      const validation = await validateAttendance(attendanceData.latitude, attendanceData.longitude);
      
      if (!validation) {
        toast.error('Failed to validate attendance');
        return false;
      }
      
      if (!validation.can_attend) {
        let errorMessage = 'Cannot check in: ';
        if (!validation.location_valid) errorMessage += 'Outside office location. ';
        if (!validation.schedule_valid) errorMessage += 'Not a working day or outside schedule. ';
        if (!validation.no_duplicate) errorMessage += 'Already checked in today. ';
        if (validation.is_holiday) errorMessage += 'Today is a holiday. ';
        
        toast.error(errorMessage.trim());
        return false;
      }

      // Create attendance record with corrected late calculation
      const currentTime = new Date();
      const { data: record, error } = await supabase
        .from('attendance_records')
        .insert({
          employee_id: currentEmployee.id,
          organization_id: organizationId,
          attendance_date: currentTime.toISOString().split('T')[0],
          check_in_time: currentTime.toISOString(),
          check_in_location: {
            latitude: attendanceData.latitude,
            longitude: attendanceData.longitude
          },
          check_in_photo_path: attendanceData.photoUrl,
          office_location_id: validation.office_location_id!,
          work_schedule_id: validation.work_schedule_id!,
          is_late: validation.is_late,
          late_minutes: validation.late_minutes,
          status: 'present'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Check-in error:', error);
        toast.error('Failed to check in: ' + error.message);
        return false;
      }

      // Log detailed check-in information
      console.log('✅ Check-in successful:', {
        record_id: record.id,
        is_late: validation.is_late,
        late_minutes: validation.late_minutes,
        tolerance_end_time: validation.tolerance_end_time,
        debug_info: validation.debug_info
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

      const currentTime = new Date();
      const workingHours = calculateWorkingHours(
        new Date(existingRecord.check_in_time),
        currentTime
      );

      // Update the record with check-out information
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: currentTime.toISOString(),
          check_out_location: {
            latitude: attendanceData.latitude,
            longitude: attendanceData.longitude
          },
          check_out_photo_path: attendanceData.photoUrl,
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
