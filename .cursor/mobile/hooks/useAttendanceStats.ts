import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/config/logger';

interface AttendanceStats {
  present_days: number;
  absent_days: number;
  late_days: number;
  total_working_days: number;
  attendance_percentage: number;
}

export interface UseAttendanceStatsOptions {
  skipAttendanceRealtime?: boolean;
}

export const useAttendanceStats = (options?: UseAttendanceStatsOptions) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchAttendanceStats = async () => {
    cancelledRef.current = false;
    try {
      if (cancelledRef.current) return;
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's active organization first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.active_organization_id) {
        throw profileError || new Error('No active organization found');
      }
      if (cancelledRef.current) return;

      setOrgId(profileData.active_organization_id);

      // Try cache first (per org + month)
      const now = new Date();
      const cacheKey = `mobile.attendanceStats.${profileData.active_organization_id}.${now.getFullYear()}-${now.getMonth()+1}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { stats: AttendanceStats; ts: number };
          if (!cancelledRef.current) setStats(parsed.stats);
        } catch {}
      }
      if (cancelledRef.current) return;

      // Get employee data for the active organization
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profileData.active_organization_id)
        .single();

      if (employeeError) {
        throw employeeError;
      }
      if (!employeeData) {
        throw new Error('Employee not found');
      }

      // Get work schedule settings from database - handle multiple default schedules
      const { data: workScheduleData, error: scheduleError } = await supabase
        .from('work_schedule_settings')
        .select('working_days')
        .eq('organization_id', employeeData.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        logger.warn('Error fetching work schedule:', scheduleError);
      }

      // Use working days from database or default to all days (Mon-Sun)
      const workingDaysOfWeek = workScheduleData?.working_days || [1, 2, 3, 4, 5, 6, 7];

      // Get current month start and end dates
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const today = now.getDate();

      // Fetch national holidays for current month that apply to attendance
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('national_holidays')
        .select('date, is_recurring')
        .or(`organization_id.eq.${employeeData.organization_id},organization_id.is.null`)
        .eq('is_active', true)
        .eq('applies_to_attendance', true)
        .or(`date.gte.${monthStart.toISOString().split('T')[0]},is_recurring.eq.true`)
        .lte('date', monthEnd.toISOString().split('T')[0]);

      if (holidaysError) {
        logger.warn('Error fetching holidays:', holidaysError);
      }

      // Process holidays: include fixed holidays in current month and recurring holidays for any year
      const holidayDates = new Set<number>();
      holidaysData?.forEach(holiday => {
        const holidayDate = new Date(holiday.date);
        if (holiday.is_recurring) {
          // For recurring holidays, check if month and day match current month
          if (holidayDate.getMonth() === now.getMonth()) {
            holidayDates.add(holidayDate.getDate());
          }
        } else {
          // For non-recurring holidays, only include if they're in current month
          if (holidayDate.getMonth() === now.getMonth() && holidayDate.getFullYear() === now.getFullYear()) {
            holidayDates.add(holidayDate.getDate());
          }
        }
      });

      logger.debug('Holiday dates for this month:', Array.from(holidayDates));
      logger.debug('Working days of week:', workingDaysOfWeek);

      // Check if working every day (all 7 days of the week)
      // Note: JavaScript Date.getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
      // But database uses 1=Monday, 2=Tuesday, ..., 7=Sunday
      const worksEveryDay = workingDaysOfWeek.length === 7 && 
        [1,2,3,4,5,6,7].every(day => workingDaysOfWeek.includes(day));
        
      logger.debug('Works every day check:', worksEveryDay);

      // Fetch attendance records for current month
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('attendance_date, status, is_late, check_in_time')
        .eq('employee_id', employeeData.id)
        .gte('attendance_date', monthStart.toISOString().split('T')[0])
        .lte('attendance_date', monthEnd.toISOString().split('T')[0]);

      if (attendanceError) {
        throw attendanceError;
      }

      // Calculate working days that have elapsed until today (excluding holidays)
      let workingDaysUntilToday = 0;
      
      if (worksEveryDay) {
        // If working every day, count all days until today minus holidays
        let holidaysUntilToday = 0;
        for (let day = 1; day <= today; day++) {
          if (holidayDates.has(day)) {
            holidaysUntilToday++;
          }
        }
        workingDaysUntilToday = today - holidaysUntilToday;
      } else {
        // If specific working days, count only those days that are not holidays
        for (let day = 1; day <= today; day++) {
          const date = new Date(now.getFullYear(), now.getMonth(), day);
          const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          
          // Convert JavaScript day (0-6) to database format (1-7)
          // Database: 1=Monday, 2=Tuesday, ..., 7=Sunday
          const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          const isWorkingDay = workingDaysOfWeek.includes(dbDayOfWeek);
          const isHoliday = holidayDates.has(day);
          
          if (isWorkingDay && !isHoliday) {
            workingDaysUntilToday++;
          }
          
          // Debug log for problematic dates
          if (day === 17) { // 17 Agustus
            if (import.meta.env?.DEV) logger.debug(`Day ${day}: dayOfWeek=${dayOfWeek}, isWorkingDay=${isWorkingDay}, isHoliday=${isHoliday}`);
          }
        }
      }

      // Calculate total working days in the month (excluding holidays)
      // Based on working_days from work_schedule_settings
      const totalDaysInMonth = monthEnd.getDate();
      let totalWorkingDays = 0;
      
      if (worksEveryDay) {
        // If working every day, total working days = total days - holidays
        totalWorkingDays = totalDaysInMonth - holidayDates.size;
      } else {
        // If specific working days, count only those days that are not holidays
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(now.getFullYear(), now.getMonth(), day);
          const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          
          // Convert JavaScript day (0-6) to database format (1-7)
          const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          const isWorkingDay = workingDaysOfWeek.includes(dbDayOfWeek);
          const isHoliday = holidayDates.has(day);
          
          // Count as working day if it's in working_days and not a holiday
          if (isWorkingDay && !isHoliday) {
            totalWorkingDays++;
          }
        }
      }

      logger.debug(`Total working days in month: ${totalWorkingDays}`);
      logger.debug(`Working days until today: ${workingDaysUntilToday}`);

      // Count actual present days (attendance records with check_in_time on working days)
      let actualPresentDays = 0;
      
      if (worksEveryDay) {
        // If working every day, count attendance on all days except holidays
        for (let day = 1; day <= today; day++) {
          const isHoliday = holidayDates.has(day);
          
          if (!isHoliday) {
            const attendanceForDay = attendanceData?.find(record => {
              const recordDate = new Date(record.attendance_date);
              return recordDate.getDate() === day && record.check_in_time;
            });
            if (attendanceForDay) {
              actualPresentDays++;
            }
          }
        }
      } else {
        // If specific working days, count only those days that are not holidays
        for (let day = 1; day <= today; day++) {
          const date = new Date(now.getFullYear(), now.getMonth(), day);
          const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          
          // Convert JavaScript day (0-6) to database format (1-7)
          const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          const isWorkingDay = workingDaysOfWeek.includes(dbDayOfWeek);
          const isHoliday = holidayDates.has(day);
          
          if (isWorkingDay && !isHoliday) {
            const attendanceForDay = attendanceData?.find(record => {
              const recordDate = new Date(record.attendance_date);
              return recordDate.getDate() === day && record.check_in_time;
            });
            if (attendanceForDay) {
              actualPresentDays++;
            }
          }
        }
      }

      const lateDays = attendanceData?.filter(record => 
        record.is_late === true
      ).length || 0;

      const absentDays = Math.max(0, workingDaysUntilToday - actualPresentDays);
      const attendancePercentage = workingDaysUntilToday > 0 ? (actualPresentDays / workingDaysUntilToday) * 100 : 0;

      if (cancelledRef.current) return;
      setStats({
        present_days: actualPresentDays,
        absent_days: absentDays,
        late_days: lateDays,
        total_working_days: totalWorkingDays,
        attendance_percentage: Math.round(attendancePercentage)
      });

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ stats: {
          present_days: actualPresentDays,
          absent_days: absentDays,
          late_days: lateDays,
          total_working_days: totalWorkingDays,
          attendance_percentage: Math.round(attendancePercentage)
        }, ts: Date.now() }));
      } catch {}

    } catch (err) {
      logger.error('Error fetching attendance stats:', err);
      if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to fetch attendance stats');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const skipAttendanceRealtime = options?.skipAttendanceRealtime === true;

  useEffect(() => {
    fetchAttendanceStats();

    // Set up realtime listeners for automatic updates
    let visibilityCleanup: (() => void) | undefined;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') fetchAttendanceStats();
      };
      document.addEventListener('visibilitychange', onVisible, { once: true });
      visibilityCleanup = () => document.removeEventListener('visibilitychange', onVisible);
    }

    let channelBuilder = supabase.channel('attendance-stats-updates');
    if (!skipAttendanceRealtime) {
      channelBuilder = channelBuilder.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records'
        },
        () => {
          logger.debug('Attendance records updated, refreshing stats...');
          fetchAttendanceStats();
        }
      );
    }
    const attendanceChannel = channelBuilder
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'national_holidays'
        },
        () => {
          logger.debug('National holidays updated, refreshing stats...');
          fetchAttendanceStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_schedule_settings'
        },
        () => {
          logger.debug('Work schedule settings updated, refreshing stats...');
          fetchAttendanceStats();
        }
      )
      .subscribe();

    return () => {
      cancelledRef.current = true;
      visibilityCleanup?.();
      try { supabase.removeChannel(attendanceChannel); } catch {}
    };
  }, [skipAttendanceRealtime]);

  return {
    stats,
    loading,
    error,
    refetch: fetchAttendanceStats,
  };
};
