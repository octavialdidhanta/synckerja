import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

export const useAttendanceRecords = (organizationId?: string) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { data: currentEmployee } = useCurrentEmployee();

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ['attendance-records', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      console.log('Fetching attendance records for organization:', organizationId);
      
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          employees!inner (
            id,
            full_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .order('attendance_date', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching attendance records:', error);
        throw error;
      }
      
      console.log('Attendance records fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!organizationId
  });

  const getDefaultWorkScheduleId = async () => {
    if (!organizationId) return null;
    
    const { data: schedules, error } = await supabase
      .from('work_schedule_settings')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error fetching work schedules:', error);
      return null;
    }

    return schedules?.[0]?.id || null;
  };

  const getDefaultShiftId = async () => {
    if (!organizationId) return null;
    
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error fetching shifts:', error);
      return null;
    }

    return shifts?.[0]?.id || null;
  };

  const createAttendanceRecord = useMutation({
    mutationFn: async (record: {
      attendance_date: string;
      check_in_time?: string;
      check_in_location?: any;
      check_in_photo_path?: string;
      status?: string;
      is_late?: boolean;
      late_minutes?: number;
      working_hours_minutes?: number;
    }) => {
      if (!currentEmployee?.id || !organizationId) {
        throw new Error('Employee or organization not found');
      }

      console.log('Creating attendance record:', {
        employee_id: currentEmployee.id,
        organization_id: organizationId,
        record
      });

      setIsSubmitting(true);
      
      const workScheduleId = await getDefaultWorkScheduleId();
      const shiftId = await getDefaultShiftId();
      
      const attendanceData = {
        employee_id: currentEmployee.id,
        organization_id: organizationId,
        office_location_id: '00000000-0000-0000-0000-000000000000',
        work_schedule_id: workScheduleId,
        shift_id: shiftId,
        ...record
      };
      
      const { data, error } = await supabase
        .from('attendance_records')
        .insert(attendanceData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating attendance record:', error);
        throw error;
      }
      
      console.log('Attendance record created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      toast.success('Attendance recorded successfully');
      console.log('Attendance record created:', data);
    },
    onError: (error) => {
      console.error('Failed to create attendance record:', error);
      toast.error('Failed to record attendance: ' + error.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const updateCheckOut = useMutation({
    mutationFn: async ({ 
      recordId, 
      checkOutTime, 
      checkOutLocation, 
      checkOutPhotoPath,
      workingHoursMinutes
    }: {
      recordId: string;
      checkOutTime: string;
      checkOutLocation: any;
      checkOutPhotoPath?: string;
      workingHoursMinutes?: number;
    }) => {
      console.log('Updating check out for record:', recordId);
      
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: checkOutTime,
          check_out_location: checkOutLocation,
          check_out_photo_path: checkOutPhotoPath,
          working_hours_minutes: workingHoursMinutes || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .select()
        .single();

      if (error) {
        console.error('Error updating check out:', error);
        throw error;
      }

      console.log('Check out updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      toast.success('Check out recorded successfully');
    },
    onError: (error) => {
      console.error('Failed to update check out:', error);
      toast.error('Failed to record check out: ' + error.message);
    }
  });

  const submitAttendance = useCallback(async (
    location: { latitude: number; longitude: number },
    validationResult: any,
    photoPath?: string
  ) => {
    try {
      console.log('Submitting attendance with:', {
        location,
        validationResult,
        photoPath: photoPath ? 'present' : 'none'
      });

      const attendanceData = {
        attendance_date: new Date().toISOString().split('T')[0],
        check_in_time: new Date().toISOString(),
        check_in_location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: 'Location recorded'
        },
        check_in_photo_path: photoPath,
        status: validationResult.isLate ? 'late' : 'present',
        is_late: validationResult.isLate || false,
        late_minutes: validationResult.lateMinutes || 0,
        working_hours_minutes: 0
      };

      console.log('Final attendance data:', attendanceData);
      await createAttendanceRecord.mutateAsync(attendanceData);
      
      return true;
    } catch (error) {
      console.error('Error submitting attendance:', error);
      return false;
    }
  }, [createAttendanceRecord]);

  return {
    records,
    isLoading,
    error,
    isSubmitting,
    submitAttendance,
    updateCheckOut: updateCheckOut.mutateAsync,
    createRecord: createAttendanceRecord.mutateAsync
  };
};

export default useAttendanceRecords;
