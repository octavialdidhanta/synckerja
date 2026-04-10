import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/config/logger";
import { useRealtimeAttendance } from "./useRealtimeData";

export const useAttendanceData = () => {
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [officeLocation, setOfficeLocation] = useState<any>(null);
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [workSchedule, setWorkSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [userForPresence, setUserForPresence] = useState<{ id: string; name: string } | null>(null);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Reset all data when organization changes
      setTodayAttendance(null);
      setOfficeLocation(null);
      setTodaySchedule(null);
      setWorkSchedule(null);
      setUserForPresence(null);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError(new Error('NO_USER'));
        return;
      }

      // Get user's active organization and name from profile
      const { data: profileRaw, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id, full_name')
        .eq('user_id', user.id)
        .single();
      if (profileError) {
        setError(new Error('FETCH_PROFILE_FAILED'));
        return;
      }
      const profile = profileRaw as unknown as { active_organization_id: string; full_name?: string } | null;

      if (!profile?.active_organization_id) {
        setError(new Error('NO_ORG'));
        return;
      }

      setUserForPresence({
        id: user.id,
        name: profile?.full_name ?? user.email ?? 'Unknown',
      });

      // Check if organization changed
      if (activeOrganizationId && activeOrganizationId !== profile.active_organization_id) {
        logger.debug('Organization changed from', activeOrganizationId, 'to', profile.active_organization_id);
      }

      setActiveOrganizationId(profile.active_organization_id);

      // Get employee data for the active organization (Supabase types can be excessively deep here)
      // @ts-ignore Supabase client generic depth limit
      const { data: employeeRaw } = await supabase
        .from('employees')
        .select(`
          id, 
          organization_id,
          departments!inner(name)
        `)
        .eq('user_id', user.id)
        .eq('organization_id', profile.active_organization_id)
        .limit(1)
        .single();
      const employee = employeeRaw as unknown as { id: string; organization_id: string; departments?: { name?: string } } | null;

      if (!employee) {
        setError(new Error('NO_EMPLOYEE'));
        return;
      }

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: attendanceRaw } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('attendance_date', today)
        .maybeSingle();
      setTodayAttendance(attendanceRaw as unknown as any);

      // Get office location
      const { data: officesRaw } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', employee.organization_id)
        .eq('is_active', true)
        .limit(1);
      type OfficeRow = { name: string; address: string; latitude: number | string; longitude: number | string; radius_meters: number };
      const offices = (officesRaw as unknown as OfficeRow[] | null) ?? null;

      const officeName = offices?.length ? offices[0].name : "Kantor Pusat";
      if (offices && offices.length > 0) {
        const office = offices[0];
        setOfficeLocation({
          name: office.name,
          address: office.address,
          latitude: typeof office.latitude === 'string' ? parseFloat(office.latitude) : office.latitude,
          longitude: typeof office.longitude === 'string' ? parseFloat(office.longitude) : office.longitude,
          radius: office.radius_meters
        });
      }

      // Get work schedule from work_schedule_settings - try default first, then any active one
      type WorkScheduleRow = {
        working_days?: number[];
        start_time?: string;
        end_time?: string;
        late_tolerance_minutes?: number;
        break_start_time?: string;
        break_end_time?: string;
      };
      let { data: workScheduleRaw } = await supabase
        .from('work_schedule_settings')
        .select('*')
        .eq('organization_id', employee.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();
      let workScheduleData = workScheduleRaw as unknown as WorkScheduleRow | null;

      // If no default found, get any active work schedule
      if (!workScheduleData) {
        const { data: fallbackRaw } = await supabase
          .from('work_schedule_settings')
          .select('*')
          .eq('organization_id', employee.organization_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        workScheduleData = fallbackRaw as unknown as WorkScheduleRow | null;
      }

      const { data: holidaysRaw } = await supabase
        .from("national_holidays")
        .select("id, name, date, is_recurring, is_active, applies_to_attendance, country_code")
        .or(`organization_id.eq.${employee.organization_id},organization_id.is.null`)
        .eq("is_active", true)
        .eq("applies_to_attendance", true);
      type HolidayRow = { id: string; name?: string; date: string; is_recurring?: boolean; is_active?: boolean; applies_to_attendance?: boolean; country_code?: string };
      const activeHolidays = (holidaysRaw as unknown as HolidayRow[] | null) ?? [];

      const todayDate = new Date();
      const todayIso = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(
        todayDate.getDate(),
      ).padStart(2, "0")}`;

      const matchHoliday = activeHolidays.find((holiday) => {
        if (!holiday.is_active || !holiday.applies_to_attendance) return false;
        if (holiday.is_recurring || holiday.country_code) {
          const holidayDate = new Date(holiday.date);
          return (
            holidayDate.getMonth() === todayDate.getMonth() &&
            holidayDate.getDate() === todayDate.getDate()
          );
        }
        return holiday.date === todayIso;
      });

      if (workScheduleData) {
        setWorkSchedule(workScheduleData);
        
        // Check if today is a working day - convert JS day (0=Sunday) to DB day (7=Sunday)
        const currentDay = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
        const dbDay = currentDay === 0 ? 7 : currentDay; // Convert Sunday from 0 to 7
        const scheduledWorkingDay = workScheduleData.working_days?.includes(dbDay);
        const isHoliday = Boolean(matchHoliday);
        const isWorkingDay = scheduledWorkingDay && !isHoliday;
        logger.debug('Current day:', currentDay, 'DB day:', dbDay, 'Working days:', workScheduleData.working_days, 'Is working day:', isWorkingDay);
        
        setTodaySchedule({
          startTime: workScheduleData.start_time?.substring(0, 5) || "08:00",
          endTime: workScheduleData.end_time?.substring(0, 5) || "17:00",
          location: officeName,
          department: employee?.departments?.name || "IT Department",
          notes: isHoliday
            ? matchHoliday?.name
              ? `Hari libur: ${matchHoliday.name}`
              : "Hari ini libur"
            : isWorkingDay
              ? "Hari kerja sesuai jadwal"
              : "Hari ini libur",
          isWorkingDay,
          isHoliday,
          holidayName: matchHoliday?.name ?? null,
          lateToleranceMinutes: workScheduleData.late_tolerance_minutes || 0,
          breakStartTime: workScheduleData.break_start_time?.substring(0, 5),
          breakEndTime: workScheduleData.break_end_time?.substring(0, 5)
        });
      } else {
        // Fallback if no work schedule found
        setTodaySchedule({
          startTime: "08:00",
          endTime: "17:00", 
          location: officeName,
          department: employee?.departments?.name || "IT Department",
          notes: "Jadwal kerja default",
          isWorkingDay: true,
          isHoliday: false,
          holidayName: null,
          lateToleranceMinutes: 0
        });
      }

    } catch (err) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
      logger.error('Error fetching attendance data:', errObj);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  // Setup realtime attendance updates - only when organizationId is available
  const { isConnected: realtimeConnected } = useRealtimeAttendance(
    activeOrganizationId && activeOrganizationId.length > 0 ? activeOrganizationId : 'skip',
    () => {
      logger.realtime('Real-time attendance update detected, refetching data');
      fetchAttendanceData();
    }
  );

  // Run once on mount to load initial attendance data
  useEffect(() => {
    fetchAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only on mount
  }, []);

  // Listen for profile changes (organization switching); subscription is stable
  useEffect(() => {
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          logger.debug('Profile updated, refetching attendance data', payload);
          // Small delay to ensure the change is committed
          setTimeout(() => {
            fetchAttendanceData();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once, listen forever
  }, []);

  return {
    todayAttendance,
    officeLocation,
    todaySchedule,
    workSchedule,
    loading,
    error,
    realtimeConnected,
    refetch: fetchAttendanceData,
    clearError,
    userForPresence,
    organizationId: activeOrganizationId ?? '',
  };
};