
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

export interface AttendanceValidationResult {
  isValid: boolean;
  locationValid: boolean;
  faceValid: boolean; // Always true now
  scheduleValid: boolean;
  isHoliday?: boolean;
  isLate?: boolean;
  lateMinutes?: number;
  validationSummary: AttendanceValidationSummary[];
  debugInfo?: any; // Add debug info for troubleshooting
}

export interface AttendanceValidationSummary {
  type: string;
  status: 'valid' | 'invalid' | 'pending';
  details: any;
  validated_at: string;
}

export const useValidationStats = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['validation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_validations')
        .select('validation_type, validation_status')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Error fetching validation stats:', error);
        throw error;
      }

      const stats = {
        totalValidations: data?.length || 0,
        locationValid: data?.filter(v => v.validation_type === 'location' && v.validation_status === 'valid').length || 0,
        faceValid: data?.filter(v => v.validation_type === 'face' && v.validation_status === 'valid').length || 0,
        scheduleValid: data?.filter(v => v.validation_type === 'schedule' && v.validation_status === 'valid').length || 0,
        failedValidations: data?.filter(v => v.validation_status === 'invalid').length || 0,
        total: data?.length || 0,
        validCount: data?.filter(v => v.validation_status === 'valid').length || 0,
        invalidCount: data?.filter(v => v.validation_status === 'invalid').length || 0,
        locationInvalid: data?.filter(v => v.validation_type === 'location' && v.validation_status === 'invalid').length || 0,
        faceInvalid: 0, // Always 0 since face validation is removed
        scheduleInvalid: data?.filter(v => v.validation_type === 'schedule' && v.validation_status === 'invalid').length || 0,
        deviceValid: data?.filter(v => v.validation_type === 'device' && v.validation_status === 'valid').length || 0,
        deviceInvalid: data?.filter(v => v.validation_type === 'device' && v.validation_status === 'invalid').length || 0
      };

      return stats;
    }
  });

  return { 
    data: data || {
      totalValidations: 0,
      locationValid: 0,
      faceValid: 0,
      scheduleValid: 0,
      failedValidations: 0,
      total: 0,
      validCount: 0,
      invalidCount: 0,
      locationInvalid: 0,
      faceInvalid: 0,
      scheduleInvalid: 0,
      deviceValid: 0,
      deviceInvalid: 0
    }, 
    isLoading, 
    error 
  };
};

export const useAttendanceValidation = (organizationId?: string) => {
  const [isValidating, setIsValidating] = useState(false);
  const { data: currentEmployee } = useCurrentEmployee();

  const validateAttendance = async (
    latitude: number,
    longitude: number,
    faceImageData?: string // Optional but not used
  ): Promise<AttendanceValidationResult> => {
    if (!currentEmployee?.id || !organizationId) {
      console.error('Missing employee or organization:', { 
        employeeId: currentEmployee?.id, 
        organizationId 
      });
      toast.error('Employee or organization not found');
      return {
        isValid: false,
        locationValid: false,
        faceValid: true, // Always true
        scheduleValid: false,
        validationSummary: []
      };
    }

    console.log('Starting attendance validation:', {
      employeeId: currentEmployee.id,
      organizationId,
      latitude,
      longitude,
      currentDay: new Date().getDay(),
      currentTime: new Date().toLocaleString()
    });

    setIsValidating(true);
    
    try {
      // Use the comprehensive validation function (face validation removed)
      const { data, error } = await supabase.rpc('validate_attendance_comprehensive', {
        employee_id_param: currentEmployee.id,
        organization_id_param: organizationId,
        latitude_param: latitude,
        longitude_param: longitude,
        face_image_data: null // Always null since face validation is removed
      });

      if (error) {
        console.error('Validation error:', error);
        toast.error('Failed to validate attendance: ' + error.message);
        return {
          isValid: false,
          locationValid: false,
          faceValid: true, // Always true
          scheduleValid: false,
          validationSummary: []
        };
      }

      const raw = data as unknown;
      const result = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null | undefined;
      console.log('Validation result from database:', result);
      console.log('Debug info:', result?.debug_info);
      
      // Show detailed debug information if schedule is invalid
      if (!result?.schedule_valid) {
        const dbg = result?.debug_info as Record<string, unknown> | undefined;
        console.log('Schedule validation failed. Debug details:', {
          currentDay: result?.current_day,
          workingDays: result?.working_days,
          scheduleFound: dbg?.schedule_found,
          isWorkingDay: dbg?.is_working_day,
          workingDaysArray: dbg?.working_days_array
        });
        
        const wda = dbg?.working_days_array as number[] | undefined;
        if (wda?.length) {
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const currentDayName = dayNames[Number(result?.current_day)];
          const workingDayNames = wda.map((day: number) => dayNames[day]);
          
          toast.error(`Hari ${currentDayName} bukan hari kerja. Hari kerja: ${workingDayNames.join(', ')}`);
        } else {
          toast.error('Jadwal kerja tidak ditemukan atau belum dikonfigurasi');
        }
      }
      
      const validationResult = {
        isValid: Boolean(result?.can_attend),
        locationValid: Boolean(result?.location_valid),
        faceValid: true, // Always true since face validation is removed
        scheduleValid: Boolean(result?.schedule_valid),
        isHoliday: Boolean(result?.is_holiday),
        isLate: Boolean(result?.is_late),
        lateMinutes: Number(result?.late_minutes) || 0,
        validationSummary: [],
        debugInfo: result?.debug_info
      };

      console.log('Processed validation result:', validationResult);
      return validationResult;
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Validation failed: ' + (error as Error).message);
      return {
        isValid: false,
        locationValid: false,
        faceValid: true, // Always true
        scheduleValid: false,
        validationSummary: []
      };
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationSummary = async (attendanceRecordId: string): Promise<AttendanceValidationSummary[]> => {
    try {
      const { data, error } = await supabase
        .from('attendance_validations')
        .select('*')
        .eq('attendance_record_id', attendanceRecordId)
        .order('validated_at', { ascending: false });

      if (error) {
        console.error('Error getting validation summary:', error);
        return [];
      }

      return data?.map(v => ({
        type: v.validation_type,
        status: v.validation_status as 'valid' | 'invalid' | 'pending',
        details: v.validation_details,
        validated_at: v.validated_at
      })) || [];
    } catch (error) {
      console.error('Error getting validation summary:', error);
      return [];
    }
  };

  const createValidationRecord = async (
    attendanceRecordId: string,
    validationType: string,
    validationStatus: 'valid' | 'invalid' | 'pending',
    validationDetails: any,
    organizationIdParam: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('attendance_validations')
        .insert({
          attendance_record_id: attendanceRecordId,
          organization_id: organizationIdParam,
          validation_type: validationType,
          validation_status: validationStatus,
          validation_details: validationDetails,
          validated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating validation record:', error);
        throw error;
      }
      
      console.log('Validation record created:', data);
      return data;
    } catch (error) {
      console.error('Error creating validation record:', error);
      throw error;
    }
  };

  return {
    validateAttendance,
    getValidationSummary,
    createValidationRecord,
    isValidating
  };
};
