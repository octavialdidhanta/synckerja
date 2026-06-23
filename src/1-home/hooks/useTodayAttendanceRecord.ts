import { useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

export type TodayAttendanceRecord = Record<string, unknown> & {
  id?: string;
  attendance_date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
};

export function getTodayAttendanceDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function todayAttendanceQueryKey(
  employeeId?: string | null,
  organizationId?: string | null,
  date: string = getTodayAttendanceDateString(),
) {
  return ['today-attendance-record', employeeId ?? null, organizationId ?? null, date] as const;
}

export async function fetchTodayAttendanceRecord(
  employeeId: string,
  organizationId: string,
  date: string = getTodayAttendanceDateString(),
): Promise<TodayAttendanceRecord | null> {
  const { data: record, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('organization_id', organizationId)
    .eq('attendance_date', date)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (record as TodayAttendanceRecord | null) ?? null;
}

export async function invalidateTodayAttendanceRecord(
  queryClient: QueryClient,
  employeeId: string,
  organizationId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: todayAttendanceQueryKey(employeeId, organizationId),
  });
}

type UseTodayAttendanceRecordOptions = {
  enabled?: boolean;
};

/** Shared today's attendance row for Home quick menu + OKR attendance status. */
export function useTodayAttendanceRecord(options: UseTodayAttendanceRecordOptions = {}) {
  const { enabled = true } = options;
  const { organizationId } = useCurrentOrg();
  const { data: employee } = useCurrentEmployee();
  const employeeId = employee?.id;
  const today = useMemo(() => getTodayAttendanceDateString(), []);

  return useQuery({
    queryKey: todayAttendanceQueryKey(employeeId, organizationId, today),
    queryFn: async () => {
      if (!employeeId || !organizationId) {
        return null;
      }
      return fetchTodayAttendanceRecord(employeeId, organizationId, today);
    },
    enabled: enabled && !!employeeId && !!organizationId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
