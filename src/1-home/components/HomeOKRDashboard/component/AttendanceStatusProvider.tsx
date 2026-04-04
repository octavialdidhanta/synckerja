
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '../hooks/useCurrentOrg';

interface AttendanceStatusContextType {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  todayRecord: any;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
}

const AttendanceStatusContext = createContext<AttendanceStatusContextType>({
  hasCheckedIn: false,
  hasCheckedOut: false,
  todayRecord: null,
  isLoading: true,
  refreshStatus: async () => {}
});

export const useAttendanceStatus = () => {
  return useContext(AttendanceStatusContext);
};

interface AttendanceStatusProviderProps {
  children: React.ReactNode;
}

export const AttendanceStatusProvider = ({ children }: AttendanceStatusProviderProps) => {
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { organizationId } = useCurrentOrg();

  const refreshStatus = async () => {
    if (!organizationId) {
      if (import.meta.env?.DEV) {
        console.log('⚠️ No organization ID, skipping status refresh');
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (import.meta.env?.DEV) {
          console.log('⚠️ No authenticated user');
        }
        setIsLoading(false);
        return;
      }

      // Get employee record
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (employeeError || !employee) {
        if (import.meta.env?.DEV) {
          console.error('❌ Employee not found:', employeeError);
        }
        setIsLoading(false);
        return;
      }

      if (import.meta.env?.DEV) {
        console.log('👤 Employee found:', employee);
      }

      // Get today's attendance record with penalties - simplified query to avoid 406 errors
      const today = new Date().toISOString().split('T')[0];
      const { data: record, error: recordError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('organization_id', organizationId)
        .eq('attendance_date', today)
        .maybeSingle();

      if (recordError && recordError.code !== 'PGRST116') {
        if (import.meta.env?.DEV) {
          console.error('❌ Error fetching attendance record:', recordError);
        }
      }

      if (import.meta.env?.DEV) {
        console.log('📋 Today\'s record with penalties:', record);
      }

      if (record) {
        setTodayRecord(record);
        setHasCheckedIn(!!(record.check_in_at || record.check_in_time));
        setHasCheckedOut(!!(record.check_out_at || record.check_out_time));
        if (import.meta.env?.DEV) {
          console.log('✅ Status updated:', {
            checkIn: !!record.check_in_time,
            checkOut: !!record.check_out_time,
            isLate: record.is_late,
            lateMinutes: record.late_minutes,
            status: record.status,
            penaltiesCount: 0
          });
        }
      } else {
        setTodayRecord(null);
        setHasCheckedIn(false);
        setHasCheckedOut(false);
        if (import.meta.env?.DEV) {
          console.log('📝 No attendance record for today');
        }
      }
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.error('❌ Error refreshing attendance status:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only refresh if organizationId is available
    if (organizationId) {
      refreshStatus();
    } else {
      setIsLoading(false);
    }
  }, [organizationId]);

  const contextValue = {
    hasCheckedIn,
    hasCheckedOut,
    todayRecord,
    isLoading,
    refreshStatus
  };

  return (
    <AttendanceStatusContext.Provider value={contextValue}>
      {children}
    </AttendanceStatusContext.Provider>
  );
};
