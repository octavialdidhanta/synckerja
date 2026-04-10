import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/config/logger";
import { useRealtimeData } from "./useRealtimeData";

interface AttendanceHistoryItem {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  is_late: boolean;
  late_minutes: number;
  working_hours_minutes: number;
  penalties: {
    penalty_amount: number;
    penalty_reason: string;
    status: string;
  }[];
}

export interface UseAttendanceHistoryOptions {
  onRealtimeRefetch?: () => void;
}

export const useAttendanceHistory = (options?: UseAttendanceHistoryOptions) => {
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const onRealtimeRefetchRef = useRef(options?.onRealtimeRefetch);
  onRealtimeRefetchRef.current = options?.onRealtimeRefetch;

  const fetchAttendanceHistory = async () => {
    cancelledRef.current = false;
    try {
      if (cancelledRef.current) return;
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (cancelledRef.current) return;

      // Get user's active organization first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.active_organization_id) {
        if (!cancelledRef.current) setError("No active organization found");
        return;
      }
      if (cancelledRef.current) return;

      // Get employee data for the active organization
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profileData.active_organization_id)
        .single();

      if (employeeError) {
        if (!cancelledRef.current) setError("Failed to get employee data");
        return;
      }
      if (!employee) {
        if (!cancelledRef.current) setError("Employee not found");
        return;
      }
      if (cancelledRef.current) return;

      setOrganizationId(employee.organization_id);

      // Try cache first (per employee)
      const cacheKey = `mobile.attendanceHistory.${employee.id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { items: AttendanceHistoryItem[]; ts: number };
          if (!cancelledRef.current) setAttendanceHistory(parsed.items);
        } catch (e) {
          logger.debug('Attendance cache read failed', e);
        }
      }
      if (cancelledRef.current) return;

      // Get attendance records with penalties
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          check_in_time,
          check_out_time,
          status,
          is_late,
          late_minutes,
          working_hours_minutes
        `)
        .eq('employee_id', employee.id)
        .order('attendance_date', { ascending: false })
        .limit(20);

      if (attendanceError) {
        if (!cancelledRef.current) setError("Failed to fetch attendance data");
        return;
      }
      if (cancelledRef.current) return;

      // Get penalties for each attendance record (skip query if no records)
      const attendanceIds = attendanceData?.map(record => record.id) || [];
      let penaltiesData: { attendance_record_id: string; penalty_amount: number; penalty_reason: string; status: string }[] = [];
      if (attendanceIds.length > 0) {
        const { data: penalties, error: penaltiesError } = await supabase
          .from('attendance_penalties')
          .select(`
            attendance_record_id,
            penalty_amount,
            penalty_reason,
            status
          `)
          .in('attendance_record_id', attendanceIds)
          .eq('status', 'active');

        if (penaltiesError) {
          logger.warn('Failed to fetch penalties:', penaltiesError);
        }
        penaltiesData = penalties ?? [];
      }
      if (cancelledRef.current) return;

      // Combine attendance with penalties
      const combinedData: AttendanceHistoryItem[] = attendanceData?.map(record => ({
        ...record,
        penalties: penaltiesData?.filter(penalty => penalty.attendance_record_id === record.id) || []
      })) || [];

      setAttendanceHistory(combinedData);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ items: combinedData, ts: Date.now() }));
      } catch (e) {
        logger.debug('Attendance cache write failed', e);
      }
    } catch (err) {
      if (!cancelledRef.current) setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  // Setup realtime updates for attendance history
  const { isConnected: realtimeConnected } = useRealtimeData(
    organizationId ? [
      {
        table: 'attendance_records',
        filter: { column: 'organization_id', eq: organizationId },
        onInsert: () => {
          logger.debug('New attendance record, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        },
        onUpdate: () => {
          logger.debug('Attendance record updated, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        },
        onDelete: () => {
          logger.debug('Attendance record deleted, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        }
      },
      {
        table: 'attendance_penalties',
        filter: { column: 'organization_id', eq: organizationId },
        onInsert: () => {
          logger.debug('New penalty added, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        },
        onUpdate: () => {
          logger.debug('Penalty updated, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        },
        onDelete: () => {
          logger.debug('Penalty removed, refetching history');
          fetchAttendanceHistory();
          onRealtimeRefetchRef.current?.();
        }
      }
    ] : []
  );

  useEffect(() => {
    fetchAttendanceHistory();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return {
    attendanceHistory,
    loading,
    error,
    realtimeConnected,
    refetch: fetchAttendanceHistory
  };
};