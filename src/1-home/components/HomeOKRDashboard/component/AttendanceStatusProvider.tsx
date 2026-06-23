
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useTodayAttendanceRecord } from '@/1-home/hooks/useTodayAttendanceRecord';

interface AttendanceStatusContextType {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  todayRecord: Record<string, unknown> | null;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
}

const AttendanceStatusContext = createContext<AttendanceStatusContextType>({
  hasCheckedIn: false,
  hasCheckedOut: false,
  todayRecord: null,
  isLoading: true,
  refreshStatus: async () => {},
});

export const useAttendanceStatus = () => {
  return useContext(AttendanceStatusContext);
};

interface AttendanceStatusProviderProps {
  children: React.ReactNode;
}

export const AttendanceStatusProvider = ({ children }: AttendanceStatusProviderProps) => {
  const { data: todayRecord, isPending, refetch } = useTodayAttendanceRecord();

  const hasCheckedIn = !!(todayRecord?.check_in_at || todayRecord?.check_in_time);
  const hasCheckedOut = !!(todayRecord?.check_out_at || todayRecord?.check_out_time);

  const refreshStatus = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const contextValue = useMemo<AttendanceStatusContextType>(
    () => ({
      hasCheckedIn,
      hasCheckedOut,
      todayRecord: todayRecord ?? null,
      isLoading: isPending,
      refreshStatus,
    }),
    [hasCheckedIn, hasCheckedOut, todayRecord, isPending, refreshStatus],
  );

  return (
    <AttendanceStatusContext.Provider value={contextValue}>
      {children}
    </AttendanceStatusContext.Provider>
  );
};
