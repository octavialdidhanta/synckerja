import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/config/logger';
import { useRealtimeData } from './useRealtimeData';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

export interface WorkSchedule {
  id: string;
  name: string;
  working_days: number[];
  start_time: string;
  end_time: string;
  break_start_time?: string;
  break_end_time?: string;
  late_tolerance_minutes: number;
  overtime_threshold_minutes: number;
  is_default: boolean;
  is_active: boolean;
  timezone: string;
  organization_id: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  is_active: boolean;
  applies_to_attendance: boolean;
  country_code?: string | null;
}

type ScheduleStatus = "active" | "upcoming" | "completed" | "off" | "holiday";

export interface ScheduleDay {
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  location: string;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
}

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const useWorkSchedule = () => {
  const { language } = useAppTranslation();
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const dayNames = language === 'en' ? DAY_NAMES_EN : DAY_NAMES_ID;
  const dateLocale = language === 'en' ? 'en-US' : 'id-ID';

  const generateWeeklySchedule = (schedule: WorkSchedule, holidaysList: Holiday[]): ScheduleDay[] => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const schedules: ScheduleDay[] = [];

    // Generate 7 days starting from Monday of current week
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Handle Sunday
      date.setDate(today.getDate() + mondayOffset + i);
      
      const dayOfWeek = date.getDay();
      const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7
      
      // Check if this day is in working_days array - make sure schedule exists and has working_days
      // DB convention: 1=Mon .. 7=Sun (JS getDay(): 0=Sun, 1=Mon .. 6=Sat; we map 0→7)
      const isScheduledDay =
        schedule &&
        Array.isArray(schedule.working_days) &&
        schedule.working_days.includes(dbDayOfWeek);

      const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;

      const matchedHoliday = holidaysList.find((holiday) => {
        if (!holiday.is_active || !holiday.applies_to_attendance) return false;

        if (holiday.is_recurring || holiday.country_code) {
          const holidayDate = new Date(holiday.date);
          return (
            holidayDate.getMonth() === date.getMonth() &&
            holidayDate.getDate() === date.getDate()
          );
        }

        return holiday.date === isoDate;
      });

      const isHoliday = Boolean(matchedHoliday);

      let status: ScheduleStatus = "off";
      if (isHoliday) {
        status = "holiday";
      } else if (isScheduledDay) {
        if (date.toDateString() === today.toDateString()) {
          status = "active";
        } else if (date < today) {
          status = "completed";
        } else {
          status = "upcoming";
        }
      }

      const isWorkingDay = isScheduledDay && !isHoliday;

      schedules.push({
        day: dayNames[dayOfWeek],
        date: date.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }),
        startTime:
          isWorkingDay && status !== "holiday" ? (schedule.start_time?.slice(0, 5) ?? '-') : "-",
        endTime:
          isWorkingDay && status !== "holiday" ? (schedule.end_time?.slice(0, 5) ?? '-') : "-",
        status,
        location: 'Kantor',
        isWorkingDay,
        isHoliday,
        holidayName: matchedHoliday?.name ?? null,
      });
    }

    return schedules;
  };

  const fetchWorkSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's organization
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

      // Set organization ID for realtime updates
      setOrganizationId(profileData.active_organization_id);

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

      // Try cache first (per org)
      const cacheKey = `mobile.workSchedule.${employeeData.organization_id}`;
      const cached = sessionStorage.getItem(cacheKey);
      const CACHE_TTL_MS = 2 * 60 * 1000;
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { schedule: WorkSchedule; holidays?: Holiday[]; ts: number };
          setWorkSchedule(parsed.schedule);
          setHolidays(parsed.holidays ?? []);
          setInitialized(true);
          if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Convert JS day (0=Sunday) to DB day (7=Sunday)
      const currentDay = new Date().getDay();
      const dbDay = currentDay === 0 ? 7 : currentDay;

      // Fetch work schedule settings for today's specific day using PostgreSQL array operator
      let { data: scheduleData, error: scheduleError } = await supabase
        .from('work_schedule_settings')
        .select('*')
        .eq('organization_id', employeeData.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .contains('working_days', [dbDay])
        .maybeSingle();

      // If no schedule for today found, get any active schedule
      if (!scheduleData) {
        const { data: fallbackSchedule, error: fallbackError } = await supabase
          .from('work_schedule_settings')
          .select('*')
          .eq('organization_id', employeeData.organization_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        scheduleData = fallbackSchedule;
        scheduleError = fallbackError;
      }

      if (scheduleError) {
        throw scheduleError;
      }

      // Fetch active holidays that apply to attendance
      const { data: holidaysData } = await supabase
        .from("national_holidays")
        .select("id, name, date, is_recurring, is_active, applies_to_attendance, country_code")
        .or(`organization_id.eq.${employeeData.organization_id},organization_id.is.null`)
        .eq("is_active", true)
        .eq("applies_to_attendance", true);

      const activeHolidays: Holiday[] = holidaysData ?? [];
      setHolidays(activeHolidays);

      if (scheduleData) {
        setWorkSchedule(scheduleData);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ schedule: scheduleData, holidays: activeHolidays, ts: Date.now() }));
        } catch {}
      }
    } catch (err) {
      logger.error('Error fetching work schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch work schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkSchedule();
  }, []);

  // Setup realtime updates for work schedule settings (guarded by orgId)
  useRealtimeData(
    organizationId ? [
      {
        table: 'work_schedule_settings',
        filter: { column: 'organization_id', eq: organizationId },
        onInsert: () => {
          fetchWorkSchedule();
        },
        onUpdate: () => {
          fetchWorkSchedule();
        },
        onDelete: () => {
          fetchWorkSchedule();
        }
      }
    ] : []
  );

  const scheduleData = useMemo(
    () => (workSchedule ? generateWeeklySchedule(workSchedule, holidays) : []),
    [workSchedule, holidays, language]
  );

  return {
    workSchedule,
    scheduleData,
    loading,
    error,
    refetch: fetchWorkSchedule,
  };
};