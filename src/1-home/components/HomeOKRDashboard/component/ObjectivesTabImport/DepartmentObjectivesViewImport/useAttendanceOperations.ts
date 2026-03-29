import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentOrg } from '../../../hooks/useCurrentOrg';

interface CheckInParams {
  latitude: number;
  longitude: number;
  photoUrl?: string;
}

export const useAttendanceOperations = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useCurrentUser();
  const { currentOrg } = useCurrentOrg();

  const checkIn = async (params: CheckInParams): Promise<boolean> => {
    if (!user || !currentOrg) {
      toast.error('User atau organization tidak ditemukan');
      return false;
    }

    setLoading(true);
    try {
      // Get current employee
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', currentOrg)
        .single();

      if (employeeError || !employee) {
        toast.error('Data employee tidak ditemukan');
        return false;
      }

      // Create attendance record
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          employee_id: employee.id,
          organization_id: currentOrg,
          check_in_time: new Date().toISOString(),
          check_in_latitude: params.latitude,
          check_in_longitude: params.longitude,
          check_in_photo_url: params.photoUrl || null,
          status: 'present'
        });

      if (attendanceError) {
        console.error('Attendance error:', attendanceError);
        toast.error('Gagal melakukan check-in');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Terjadi kesalahan saat check-in');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkIn,
    loading
  };
};


