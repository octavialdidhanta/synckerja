import { useQuery } from '@tanstack/react-query';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

export const useEmployeeAttendanceStats = () => {
  const { currentOrg } = useCurrentOrg();

  return useQuery({
    queryKey: ['employee-attendance-stats', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) {
        throw new Error('No organization found');
      }

      logger.query('📊 Fetching employee attendance stats for org:', currentOrg.id);

      // Get current month start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id, full_name, employee_status_id, pending_removal')
        .eq('organization_id', currentOrg.id);

      if (employeeError) {
        console.error('❌ Error fetching employees:', employeeError);
        throw employeeError;
      }

      const statusIds = Array.from(
        new Set((employees || []).map((emp) => emp.employee_status_id).filter(Boolean))
      ) as string[];
      let statusNameById = new Map<string, string>();
      if (statusIds.length > 0) {
        const { data: statuses, error: statusesError } = await supabase
          .from('employee_statuses')
          .select('id, name')
          .in('id', statusIds);

        if (statusesError) {
          console.error('❌ Error fetching employee statuses:', statusesError);
          throw statusesError;
        }

        statusNameById = new Map((statuses || []).map((status) => [status.id, status.name]));
      }

      const activeEmployeeIds = (employees || [])
        .map((emp) => ({
          ...emp,
          employee_status_name: emp.employee_status_id ? statusNameById.get(emp.employee_status_id) || null : null
        }))
        .filter((emp) => isEmployeeActive(emp))
        .map((emp) => emp.id);

      if (activeEmployeeIds.length === 0) {
        return {
          attendanceRate: 100,
          presentDays: 0,
          lateDays: 0,
          leaveDays: 0,
          totalActiveEmployees: 0,
          workingDays: getWorkingDaysInMonth(startOfMonth, endOfMonth)
        };
      }

      // Get attendance records for current month
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          employee_id,
          attendance_date,
          status,
          is_late
        `)
        .eq('organization_id', currentOrg.id)
        .in('employee_id', activeEmployeeIds)
        .gte('attendance_date', startOfMonth.toISOString().split('T')[0])
        .lte('attendance_date', endOfMonth.toISOString().split('T')[0]);

      if (attendanceError) {
        console.error('❌ Error fetching attendance records:', attendanceError);
        throw attendanceError;
      }

      // Get leave requests for current month
      const { data: leaveRecords, error: leaveError } = await supabase
        .from('leave_requests')
        .select(`
          id,
          employee_id,
          start_date,
          end_date,
          total_days,
          status
        `)
        .eq('organization_id', currentOrg.id)
        .in('employee_id', activeEmployeeIds)
        .eq('status', 'approved')
        .gte('start_date', startOfMonth.toISOString().split('T')[0])
        .lte('end_date', endOfMonth.toISOString().split('T')[0]);

      if (leaveError) {
        console.error('❌ Error fetching leave records:', leaveError);
        throw leaveError;
      }

      // Calculate statistics
      const totalActiveEmployees = activeEmployeeIds.length;
      const workingDays = getWorkingDaysInMonth(startOfMonth, endOfMonth);
      
      // Calculate present days (unique employee-date combinations)
      const presentDays = attendanceRecords?.filter(record => 
        record.status === 'present' || record.status === null
      ).length || 0;

      // Calculate late days
      const lateDays = attendanceRecords?.filter(record => 
        record.is_late === true
      ).length || 0;

      // Calculate leave days from approved leave requests
      const leaveDays = leaveRecords?.reduce((total, leave) => {
        return total + (leave.total_days || 0);
      }, 0) || 0;

      // Calculate attendance rate
      const expectedAttendanceDays = totalActiveEmployees * workingDays;
      const actualAttendanceDays = presentDays;
      const attendanceRate = expectedAttendanceDays > 0 
        ? Math.round((actualAttendanceDays / expectedAttendanceDays) * 100)
        : 100;

      const stats = {
        attendanceRate,
        presentDays,
        lateDays,
        leaveDays,
        totalActiveEmployees,
        workingDays
      };

      logger.query('✅ Employee attendance stats calculated:', stats);
      return stats;
    },
    enabled: !!currentOrg?.id,
    ...attendanceHRQueryDefaults,
  });
};

// Helper function to calculate working days in a month (excluding weekends)
function getWorkingDaysInMonth(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}
