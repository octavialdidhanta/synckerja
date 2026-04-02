import { useQuery } from '@tanstack/react-query';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

function statusNameFromJoin(row: {
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}) {
  const es = row.employee_statuses;
  if (!es) return null;
  if (Array.isArray(es)) return es[0]?.name ?? null;
  return es.name ?? null;
}

export interface AttendanceAnalytics {
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalWFH: number;
  averageWorkHours: number;
  attendanceRate: number;
  flaggedRecords: number;
}

export interface EmployeeSpotlight {
  id: string;
  full_name: string;
  department: string;
  status: string;
  todayHours: number;
  weekHours: number;
  attendanceScore: number;
  isLate: boolean;
  lateMinutes?: number;
}

export interface AttendanceAlert {
  id: string;
  type: 'warning' | 'info' | 'error';
  message: string;
  time: string;
  severity: 'low' | 'medium' | 'high';
}

export const useAttendanceAnalytics = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['attendance-analytics', organizationId],
    queryFn: async (): Promise<{
      analytics: AttendanceAnalytics;
      spotlight: EmployeeSpotlight | null;
      alerts: AttendanceAlert[];
    }> => {
      if (!organizationId) {
        throw new Error('No organization found');
      }

      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // Get today's attendance records with employee details
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          employees!inner (
            id,
            full_name,
            departments (name)
          )
        `)
        .eq('employees.organization_id', organizationId)
        .eq('attendance_date', today);

      if (attendanceError) {
        console.error('Error fetching attendance records:', attendanceError);
        throw attendanceError;
      }

      // Active employees (no legacy employees.status column)
      const { data: employeesRaw, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id,
          full_name,
          pending_removal,
          employee_statuses!left(name)
        `)
        .eq('organization_id', organizationId);

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        throw employeesError;
      }

      const allEmployees = (employeesRaw ?? []).filter((row) =>
        isEmployeeActive({
          employee_status_name: statusNameFromJoin(row),
          status: null,
          pending_removal: row.pending_removal,
        })
      );

      // Calculate analytics
      const totalEmployees = allEmployees.length;
      const presentCount = attendanceRecords?.filter(r => r.status === 'present').length || 0;
      const lateCount = attendanceRecords?.filter(r => r.status === 'late').length || 0;
      const absentCount = totalEmployees - (attendanceRecords?.length || 0);
      const wfhCount = attendanceRecords?.filter(r => r.status === 'wfh').length || 0;

      // Calculate average work hours
      const totalWorkHours = attendanceRecords?.reduce((total, record) => {
        if (record.check_in_time && record.check_out_time) {
          const checkIn = new Date(`${record.attendance_date}T${record.check_in_time}`);
          const checkOut = new Date(`${record.attendance_date}T${record.check_out_time}`);
          const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          return total + hours;
        }
        return total;
      }, 0) || 0;

      const avgWorkHours = attendanceRecords?.length ? totalWorkHours / attendanceRecords.length : 0;
      const attendanceRate = totalEmployees > 0 ? ((presentCount + lateCount) / totalEmployees) * 100 : 0;

      // Find employee spotlight (most recent check-in or someone who's late)
      let spotlight: EmployeeSpotlight | null = null;
      if (attendanceRecords && attendanceRecords.length > 0) {
        const lateEmployee = attendanceRecords.find(r => r.status === 'late');
        const targetRecord = lateEmployee || attendanceRecords[0];
        
        if (targetRecord?.employees) {
          spotlight = {
            id: targetRecord.employees.id,
            full_name: targetRecord.employees.full_name,
            department: targetRecord.employees.departments?.name || 'Unknown',
            status: targetRecord.status || 'present',
            todayHours: targetRecord.check_in_time && targetRecord.check_out_time ? 
              (new Date(`${targetRecord.attendance_date}T${targetRecord.check_out_time}`).getTime() - 
               new Date(`${targetRecord.attendance_date}T${targetRecord.check_in_time}`).getTime()) / (1000 * 60 * 60) : 0,
            weekHours: 42.3, // This would need a separate query for accurate calculation
            attendanceScore: 95, // This would need historical data calculation
            isLate: targetRecord.status === 'late',
            lateMinutes: targetRecord.late_minutes || 0
          };
        }
      }

      // Generate alerts based on data
      const alerts: AttendanceAlert[] = [];
      
      if (lateCount > 0) {
        alerts.push({
          id: '1',
          type: 'warning',
          message: `${lateCount} employee${lateCount > 1 ? 's' : ''} late today`,
          time: '2 hours ago',
          severity: lateCount > 5 ? 'high' : 'medium'
        });
      }

      if (wfhCount > 0) {
        alerts.push({
          id: '2',
          type: 'info',
          message: `${wfhCount} employee${wfhCount > 1 ? 's' : ''} working from home today`,
          time: '4 hours ago',
          severity: 'low'
        });
      }

      if (absentCount > 0) {
        alerts.push({
          id: '3',
          type: 'error',
          message: `${absentCount} employee${absentCount > 1 ? 's' : ''} absent without notice`,
          time: '6 hours ago',
          severity: 'high'
        });
      }

      return {
        analytics: {
          totalPresent: presentCount,
          totalLate: lateCount,
          totalAbsent: absentCount,
          totalWFH: wfhCount,
          averageWorkHours: Number(avgWorkHours.toFixed(1)),
          attendanceRate: Number(attendanceRate.toFixed(1)),
          flaggedRecords: lateCount + absentCount
        },
        spotlight,
        alerts
      };
    },
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
  });
};