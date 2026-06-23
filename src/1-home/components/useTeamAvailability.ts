import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

export interface TeamAvailabilityData {
  name: string;
  wfo: number;
  wfh: number;
  total: number;
}

export const useTeamAvailability = (options: { enabled?: boolean } = {}) => {
  const { enabled = true } = options;
  const { currentOrg } = useCurrentOrg();

  return useQuery({
    queryKey: ['team-availability', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) {
        throw new Error('No organization found');
      }

      logger.query('👥 Fetching team availability for org:', currentOrg.id);

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Get employees with their departments and today's attendance
      const { data: rawRows, error } = await supabase
        .from('employees')
        .select(`
          id,
          full_name,
          pending_removal,
          employee_statuses!left (
            name
          ),
          departments!inner (
            id,
            name
          ),
          attendance_records!left (
            id,
            attendance_date,
            status,
            check_in_time,
            check_out_time
          )
        `)
        .eq('organization_id', currentOrg.id)
        .eq('attendance_records.attendance_date', today);

      if (error) {
        console.error('❌ Error fetching employees with attendance:', error);
        throw error;
      }

      const statusNameFromJoin = (row: {
        employee_statuses?: { name?: string } | { name?: string }[] | null;
      }) => {
        const es = row.employee_statuses;
        if (!es) return null;
        if (Array.isArray(es)) return es[0]?.name ?? null;
        return es.name ?? null;
      };

      const employeesWithAttendance = (rawRows ?? []).filter((row) =>
        isEmployeeActive({
          employee_status_name: statusNameFromJoin(row),
          status: null,
          pending_removal: row.pending_removal,
        })
      );

      logger.query('📊 Raw employees with attendance:', employeesWithAttendance);

      // Group by department and count WFO/WFH
      const departmentStats: { [key: string]: { wfo: number; wfh: number; total: number } } = {};

      employeesWithAttendance?.forEach((employee) => {
        const deptName = employee.departments?.name || 'Other';
        
        if (!departmentStats[deptName]) {
          departmentStats[deptName] = { wfo: 0, wfh: 0, total: 0 };
        }

        departmentStats[deptName].total += 1;

        // Check if employee has checked in today
        const hasAttendance = employee.attendance_records && employee.attendance_records.length > 0;
        
        if (hasAttendance) {
          // For now, consider everyone who checked in as WFO
          // In the future, this could be enhanced with location data
          departmentStats[deptName].wfo += 1;
        } else {
          // If no attendance record, consider as WFH or absent
          // This is a simple assumption - could be enhanced
          departmentStats[deptName].wfh += 1;
        }
      });

      // Convert to array format
      const teamAvailability: TeamAvailabilityData[] = Object.entries(departmentStats)
        .map(([name, stats]) => ({
          name,
          wfo: stats.wfo,
          wfh: stats.wfh,
          total: stats.total
        }))
        .filter(team => team.total > 0) // Only include departments with employees
        .sort((a, b) => b.total - a.total); // Sort by total employees descending

      logger.query('✅ Team availability calculated:', teamAvailability);
      return teamAvailability;
    },
    enabled: enabled && !!currentOrg?.id,
    staleTime: 1 * 60 * 1000, // 1 minute 
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Reduce retries
    refetchOnWindowFocus: false // Prevent unnecessary refetches
  });
};
