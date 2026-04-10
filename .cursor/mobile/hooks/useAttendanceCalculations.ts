import { useMemo } from "react";
import { format } from "date-fns";
import { id, enUS } from "date-fns/locale";

interface AttendanceRecord {
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

interface UseAttendanceCalculationsProps {
  attendanceHistory: AttendanceRecord[];
  language?: "id" | "en";
}

export const useAttendanceCalculations = ({ attendanceHistory, language = "id" }: UseAttendanceCalculationsProps) => {
  const locale = language === "id" ? id : enUS;
  const filteredStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.getDate();
    
    // Calculate total days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Calculate working days based on work schedule (Monday=1, Sunday=0)
    // Default: Monday-Saturday (1,2,3,4,5,6) as per database schema
    const workingDaysOfWeek = [1, 2, 3, 4, 5, 6]; // Mon-Sat
    
    let totalWorkingDays = 0;
    let workingDaysUntilToday = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayOfWeek = date.getDay();
      
      if (workingDaysOfWeek.includes(dayOfWeek)) {
        totalWorkingDays++;
        if (day <= today) {
          workingDaysUntilToday++;
        }
      }
    }
    
    // Count actual attendance for the current month until today
    const currentMonthAttendance = attendanceHistory.filter(record => {
      const recordDate = new Date(record.attendance_date);
      return recordDate.getMonth() === currentMonth && 
             recordDate.getFullYear() === currentYear &&
             recordDate.getDate() <= today;
    });
    
    // Count working days that have attendance records
    let actualPresentDays = 0;
    for (let day = 1; day <= today; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayOfWeek = date.getDay();
      
      // If it's a working day and has attendance record with check_in_time
      if (workingDaysOfWeek.includes(dayOfWeek)) {
        const attendanceForDay = currentMonthAttendance.find(r => 
          new Date(r.attendance_date).getDate() === day && r.check_in_time
        );
        if (attendanceForDay) {
          actualPresentDays++;
        }
      }
    }
    
    const totalPresent = actualPresentDays;
    const totalLate = currentMonthAttendance.filter(r => r.is_late).length;
    const totalEarlyLeave = currentMonthAttendance.filter(r => 
      r.check_out_time && new Date(r.check_out_time).getHours() < 17
    ).length;

    const attendanceRate = workingDaysUntilToday > 0 ? Math.round((totalPresent / workingDaysUntilToday) * 100) : 0;

    // Calculate average check-in and check-out times
    const validCheckIns = attendanceHistory.filter(r => r.check_in_time);
    const validCheckOuts = attendanceHistory.filter(r => r.check_out_time);

    let avgCheckIn = "-";
    let avgCheckOut = "-";
    let totalWorkingHours = 0;

    if (validCheckIns.length > 0) {
      const totalMinutesIn = validCheckIns.reduce((sum, record) => {
        const time = new Date(record.check_in_time!);
        return sum + (time.getHours() * 60 + time.getMinutes());
      }, 0);
      const avgMinutesIn = totalMinutesIn / validCheckIns.length;
      const hours = Math.floor(avgMinutesIn / 60);
      const minutes = Math.round(avgMinutesIn % 60);
      avgCheckIn = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    if (validCheckOuts.length > 0) {
      const totalMinutesOut = validCheckOuts.reduce((sum, record) => {
        const time = new Date(record.check_out_time!);
        return sum + (time.getHours() * 60 + time.getMinutes());
      }, 0);
      const avgMinutesOut = totalMinutesOut / validCheckOuts.length;
      const hours = Math.floor(avgMinutesOut / 60);
      const minutes = Math.round(avgMinutesOut % 60);
      avgCheckOut = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Calculate total working hours for current month only
    const currentMonthRecordsWithBothTimes = currentMonthAttendance.filter(r => r.check_in_time && r.check_out_time);
    let totalWorkingMinutes = 0;
    
    if (currentMonthRecordsWithBothTimes.length > 0) {
      // Use the working_hours_minutes field from database if available, otherwise calculate manually
      totalWorkingMinutes = currentMonthRecordsWithBothTimes.reduce((sum, record) => {
        if (record.working_hours_minutes && record.working_hours_minutes > 0) {
          return sum + record.working_hours_minutes;
        } else {
          // Fallback to manual calculation
          const checkIn = new Date(record.check_in_time!);
          const checkOut = new Date(record.check_out_time!);
          const diffMs = checkOut.getTime() - checkIn.getTime();
          const diffMinutes = diffMs / (1000 * 60);
          const workingMinutes = Math.max(0, diffMinutes - 60); // Subtract 1 hour break
          return sum + workingMinutes;
        }
      }, 0);
    }

    // Convert to hours and minutes for better display
    const workingHours = Math.floor(totalWorkingMinutes / 60);
    const workingMinutesRemainder = Math.round(totalWorkingMinutes % 60);
    totalWorkingHours = totalWorkingMinutes / 60; // Keep as decimal for backwards compatibility

    // Calculate overtime (hours worked beyond 8 hours per day)
    const totalOvertime = currentMonthRecordsWithBothTimes.reduce((sum, record) => {
      const checkIn = new Date(record.check_in_time!);
      const checkOut = new Date(record.check_out_time!);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const workHours = Math.max(0, diffHours - 1); // Subtract 1 hour break
      return sum + Math.max(0, workHours - 8); // Overtime is anything over 8 hours
    }, 0);

    return {
      workingDays: totalWorkingDays,
      attendanceRate,
      totalPresent,
      totalLate,
      totalEarlyLeave,
      totalOvertime: Math.round(totalOvertime),
      avgCheckIn,
      avgCheckOut,
      totalWorkingHours,
      workingHours,
      workingMinutesRemainder
    };
  }, [attendanceHistory]);

  const chartData = useMemo(() => {
    if (!attendanceHistory || attendanceHistory.length === 0) return [];
    
    // Group data by month
    const monthlyData = attendanceHistory.reduce((acc: Record<string, any>, record) => {
      const date = new Date(record.attendance_date);
      const monthKey = format(date, "MMM yyyy", { locale });
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          hadir: 0,
          terlambat: 0,
          tidakHadir: 0
        };
      }
      
      if (!record.check_in_time) {
        acc[monthKey].tidakHadir += 1;
      } else if (record.is_late) {
        acc[monthKey].terlambat += 1;
      } else {
        acc[monthKey].hadir += 1;
      }
      
      return acc;
    }, {});
    
    return Object.values(monthlyData).slice(-6) as Array<{
      month: string;
      hadir: number;
      terlambat: number;
      tidakHadir: number;
    }>; // Last 6 months
  }, [attendanceHistory, locale]);

  return {
    filteredStats,
    chartData
  };
};