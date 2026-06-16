
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

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
  const { employee } = useCentralizedUserData();

  const refreshStatus = useCallback(async () => {
    if (!organizationId) {
      if (import.meta.env?.DEV) {
        console.log('⚠️ No organization ID, skipping status refresh');
      }
      setIsLoading(false);
      return;
    }

    const employeeId = employee?.id;
    if (!employeeId) {
      setTodayRecord(null);
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setIsLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: record, error: recordError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('organization_id', organizationId)
        .eq('attendance_date', today)
        .maybeSingle();

      if (recordError && recordError.code !== 'PGRST116') {
        if (import.meta.env?.DEV) {
          console.error('❌ Error fetching attendance record:', recordError);
        }
      }

      if (record) {
        setTodayRecord(record);
        setHasCheckedIn(!!(record.check_in_at || record.check_in_time));
        setHasCheckedOut(!!(record.check_out_at || record.check_out_time));
      } else {
        setTodayRecord(null);
        setHasCheckedIn(false);
        setHasCheckedOut(false);
      }
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.error('❌ Error refreshing attendance status:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, employee?.id]);

  useEffect(() => {
    if (organizationId && employee?.id) {
      void refreshStatus();
    } else if (!organizationId) {
      setIsLoading(false);
    }
  }, [organizationId, employee?.id, refreshStatus]);

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
