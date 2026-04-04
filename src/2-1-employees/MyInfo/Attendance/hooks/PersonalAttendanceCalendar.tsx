import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useWorkScheduleSettings } from './useWorkScheduleSettings';
import { useAttendanceRecords } from './useAttendanceRecords';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { useOptimizedNationalHolidays } from './useOptimizedAttendanceData';
import { useAttendancePenaltyTotal } from './useAttendancePenaltyTotal';
import { EmployeePenaltyCell } from '../components/EmployeePenaltyCell';
import { useQueryClient } from '@tanstack/react-query';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useLeaveRequests } from './useLeaveRequests';
import { parseDateFromDatabase } from '../utils/dateUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { format } from 'date-fns';

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

// getMonthName and getDayName will be replaced with date-fns format using dynamic locale

const isNonWorkingDay = (date: number, month: number, year: number, workingDays: number[] = [1, 2, 3, 4, 5], nationalHolidays: any[] = []) => {
  const dayIndex = new Date(year, month, date).getDay();
  const adjustedDayIndex = dayIndex === 0 ? 7 : dayIndex;
  
  const currentDate = new Date(year, month, date);
  const localYear = currentDate.getFullYear();
  const localMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const localDay = String(currentDate.getDate()).padStart(2, '0');
  const dateString = `${localYear}-${localMonth}-${localDay}`;
  
  const monthDayString = `${localMonth}-${localDay}`;
  
  const isNationalHoliday = nationalHolidays.some(holiday => {
    if (!holiday.is_active || !holiday.applies_to_attendance) return false;
    
    if (holiday.date === dateString) return true;
    
    const holidayDate = new Date(holiday.date);
    const holidayMonth = String(holidayDate.getMonth() + 1).padStart(2, '0');
    const holidayDay = String(holidayDate.getDate()).padStart(2, '0');
    const holidayMonthDay = `${holidayMonth}-${holidayDay}`;
    
    if (holiday.is_recurring || holiday.country_code) {
      return holidayMonthDay === monthDayString;
    }
    
    return false;
  });
  
  if (isNationalHoliday) {
    return true;
  }
  
  const isNonScheduledWorkDay = !workingDays.includes(adjustedDayIndex);
  return isNonScheduledWorkDay;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'H': return 'bg-emerald-200 border-emerald-300';
    case 'I': return 'bg-primary/20 border-primary/30';
    case 'S': return 'bg-yellow-200 border-yellow-300';
    case 'C': return 'bg-orange-200 border-orange-300';
    case 'A': return 'bg-red-200 border-red-300';
    case 'T': return 'bg-purple-200 border-purple-300';
    default: return 'bg-gray-50 border-gray-200';
  }
};

interface PersonalAttendanceCalendarProps {
  employeeId: string;
}

const PersonalAttendanceCalendar = ({ employeeId }: PersonalAttendanceCalendarProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  console.log('ðŸ“… PersonalAttendanceCalendar rendered with employeeId:', employeeId);
  
  const { userData } = useCentralizedUserData();
  const { settings: workScheduleSettings, loading: scheduleLoading } = useWorkScheduleSettings();
  const { records: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceRecords(organizationId);
  const { data: nationalHolidays = [], isLoading: holidaysLoading } = useOptimizedNationalHolidays();
  const { data: leaveRequests = [], isLoading: leaveLoading } = useLeaveRequests({
    month: currentMonth + 1,
    year: currentYear
  });
  
  const { data: personalPenalties = 0 } = useAttendancePenaltyTotal(employeeId, currentMonth, currentYear);
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  
  console.log('ðŸ“Š Calendar data status:', {
    employeeId,
    organizationId,
    userData: userData?.full_name,
    scheduleLoading,
    attendanceLoading,
    holidaysLoading,
    leaveLoading,
    attendanceRecordsCount: attendanceRecords.length,
    workScheduleSettingsCount: workScheduleSettings.length
  });
  
  const defaultSchedule = workScheduleSettings.find(schedule => schedule.is_default) || workScheduleSettings[0];
  const workingDays = defaultSchedule?.working_days || [1, 2, 3, 4, 5];

  // Get month name using date-fns with dynamic locale
  const getMonthName = (month: number) => {
    const date = new Date(currentYear, month, 1);
    return format(date, 'MMMM yyyy', { locale: dateFnsLocale });
  };

  // Get day names for calendar header (Monday to Sunday)
  const getDayNames = () => {
    const dayNames: string[] = [];
    // Start from Monday (1) to Sunday (7)
    for (let i = 1; i <= 7; i++) {
      // Create a date for Monday (2024-01-01 is a Monday)
      const mondayDate = new Date(2024, 0, 1);
      const targetDate = new Date(mondayDate);
      targetDate.setDate(mondayDate.getDate() + (i - 1));
      const dayName = format(targetDate, 'EEE', { locale: dateFnsLocale });
      dayNames.push(dayName);
    }
    return dayNames;
  };
  
  useEffect(() => {
    getCurrentOrganizationId().then(({ organizationId }) => {
      setOrganizationId(organizationId);
    });
  }, []);
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const processedEmployeeData = useMemo(() => {
    const attendanceData: { [key: number]: string } = {};
    let totalLateMinutes = 0;
    
    const employeeRecords = attendanceRecords.filter(record => 
      record.employees?.id === employeeId || record.employee_id === employeeId
    );
    
    // Process attendance records
    employeeRecords.forEach(record => {
      const recordDate = new Date(record.attendance_date);
      if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
        const day = recordDate.getDate();
        
        if (record.is_late && record.late_minutes && record.late_minutes > 0) {
          totalLateMinutes += record.late_minutes;
        }
        
        if (record.is_late && record.late_minutes && record.late_minutes > 0) {
          attendanceData[day] = 'T';
        } else if (record.status === 'present') {
          attendanceData[day] = 'H';
        } else if (record.status === 'absent') {
          attendanceData[day] = 'A';
        } else if (record.status === 'sick') {
          attendanceData[day] = 'S';
        } else if (record.status === 'leave') {
          attendanceData[day] = 'C';
        } else if (record.status === 'permission') {
          attendanceData[day] = 'I';
        }
      }
    });

    // Process approved leave requests for the employee
    const employeeLeaveRequests = leaveRequests.filter(leave => 
      leave.employee_id === employeeId && leave.status === 'approved'
    );
    
    employeeLeaveRequests.forEach(leave => {
      const startDate = parseDateFromDatabase(leave.start_date);
      const endDate = parseDateFromDatabase(leave.end_date);
      
      // Mark all days in the leave period as 'C' (Cuti)
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          const day = date.getDate();
          // Only mark as leave if there's no existing attendance record
          if (!attendanceData[day]) {
            attendanceData[day] = 'C';
          }
        }
      }
    });
    
    return {
      attendanceData,
      totalLateMinutes
    };
  }, [attendanceRecords, leaveRequests, employeeId, currentMonth, currentYear]);

  const calculateWorkingDays = () => {
    let workingDaysCount = 0;
    for (let date = 1; date <= daysInMonth; date++) {
      if (!isNonWorkingDay(date, currentMonth, currentYear, workingDays, nationalHolidays)) {
        workingDaysCount++;
      }
    }
    return workingDaysCount;
  };

  const totalWorkingDays = calculateWorkingDays();

  const calculateStats = (attendanceData: any) => {
    const stats = { H: 0, A: 0, C: 0, I: 0, S: 0, T: 0 };
    Object.values(attendanceData).forEach((status: any) => {
      if (stats.hasOwnProperty(status)) {
        stats[status as keyof typeof stats]++;
      }
    });
    return stats;
  };

  const stats = calculateStats(processedEmployeeData.attendanceData);
  const attendanceRate = totalWorkingDays > 0 ? Math.round((stats.H / totalWorkingDays) * 100) : 0;

  if (scheduleLoading || holidaysLoading || attendanceLoading || leaveLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-600">{t('attendanceCalendar.loading', 'Loading attendance data...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[calc(100vh-200px)] bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">{t('attendanceCalendar.title', 'Attendance Calendar')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold text-gray-800 min-w-[150px] text-center">
              {getMonthName(currentMonth)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Employee name and summary stats */}
        <div className="bg-slate-50 px-4 py-3 rounded-lg mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="font-medium text-gray-900">{userData?.full_name || t('common.loading', 'Loading...')}</span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
              <span>{applyVariables(t('attendanceCalendar.workingDays', 'Working Days: {{days}}'), { days: String(totalWorkingDays) })}</span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span>{applyVariables(t('attendanceCalendar.attendanceRate', 'Attendance Rate: {{rate}}%'), { rate: String(attendanceRate) })}</span>
                </div>
                <Progress value={attendanceRate} className="h-2 w-full sm:w-32" />
              </div>
              <span className="hidden sm:inline">{t('attendanceCalendar.penaltyThisMonth', 'Penalty This Month')}: <strong className="text-red-600">{formatToRupiah(personalPenalties)}</strong></span>
              <span className="sm:hidden">{t('attendanceCalendar.penalty', 'Penalty')}: <strong className="text-red-600">{formatToRupiah(personalPenalties)}</strong></span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-emerald-300 bg-emerald-200" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.present', 'Present')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-primary/30 bg-primary/20" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.permission', 'Permission')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-yellow-300 bg-yellow-200" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.sick', 'Sick')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-orange-300 bg-orange-200" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.leave', 'Leave')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-red-300 bg-red-200" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.absent', 'Absent')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 shrink-0 rounded border border-purple-300 bg-purple-200" aria-hidden />
            <span className="text-gray-600">{t('attendanceCalendar.status.late', 'Late')}</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto max-h-[900px]">
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden min-w-[280px]">
          {/* Days of week header */}
          {getDayNames().map((day, index) => (
            <div key={index} className="bg-slate-700 text-white p-2 sm:p-3 text-center font-medium text-xs sm:text-sm">
              {day}
            </div>
          ))}
          
          {/* Calendar dates with proper positioning */}
          {(() => {
            // Get first day of month (0=Sunday, 1=Monday, ..., 6=Saturday)
            const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
            // Convert to Monday=0 format (0=Monday, 1=Tuesday, ..., 6=Sunday)
            const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
            
            const cells = [];
            
            // Add empty cells for offset
            for (let i = 0; i < adjustedFirstDay; i++) {
              cells.push(
                <div key={`empty-${i}`} className="bg-gray-100 p-2 sm:p-3 min-h-[50px] sm:min-h-[60px]"></div>
              );
            }
            
            // Add actual dates
            for (let date = 1; date <= daysInMonth; date++) {
              const status = processedEmployeeData.attendanceData[date];
              const isNonWorking = isNonWorkingDay(date, currentMonth, currentYear, workingDays, nationalHolidays);
              
              cells.push(
                <div 
                  key={date} 
                  className={`p-2 sm:p-3 min-h-[50px] sm:min-h-[60px] flex flex-col items-center justify-center border-r border-b border-gray-100 ${
                    isNonWorking ? 'bg-red-500 text-white' : status ? getStatusColor(status) : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm sm:text-lg font-semibold ${isNonWorking ? 'text-white' : 'text-gray-800'}`}>{date}</span>
                </div>
              );
            }
            
            return cells;
          })()}
        </div>
        
        {/* Summary section */}
        <div className="bg-gray-50 p-4 border-t space-y-4 overflow-y-auto max-h-[500px]">
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 text-center">
            <div className="bg-emerald-50 p-2 sm:p-3 rounded border">
              <div className="text-sm sm:text-lg font-bold text-emerald-700">{stats.H}</div>
              <div className="text-xs text-emerald-600">{t('attendanceCalendar.status.present', 'Present')}</div>
            </div>
            <div className="bg-red-50 p-2 sm:p-3 rounded border">
              <div className="text-sm sm:text-lg font-bold text-red-700">{stats.A}</div>
              <div className="text-xs text-red-600">{t('attendanceCalendar.status.absent', 'Absent')}</div>
            </div>
            <div className="bg-orange-50 p-2 sm:p-3 rounded border">
              <div className="text-sm sm:text-lg font-bold text-orange-700">{stats.C}</div>
              <div className="text-xs text-orange-600">{t('attendanceCalendar.status.leave', 'Leave')}</div>
            </div>
            <div className="bg-primary/5 p-2 sm:p-3 rounded border border-primary/15">
              <div className="text-sm sm:text-lg font-bold text-primary">{stats.I}</div>
              <div className="text-xs text-primary">{t('attendanceCalendar.status.permission', 'Permission')}</div>
            </div>
            <div className="bg-yellow-50 p-2 sm:p-3 rounded border">
              <div className="text-sm sm:text-lg font-bold text-yellow-700">{stats.S}</div>
              <div className="text-xs text-yellow-600">{t('attendanceCalendar.status.sick', 'Sick')}</div>
            </div>
            <div className="bg-purple-50 p-2 sm:p-3 rounded border">
              <div className="text-sm sm:text-lg font-bold text-purple-700">{stats.T}</div>
              <div className="text-xs text-purple-600">{t('attendanceCalendar.status.late', 'Late')}</div>
            </div>
          </div>
          
          {/* Detailed Breakdown */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">{t('attendanceCalendar.latePenaltyDetails', 'Late & Penalty Details')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="text-lg sm:text-2xl font-bold text-purple-600">{processedEmployeeData.totalLateMinutes}</div>
                <div className="text-xs sm:text-sm text-gray-600">{t('attendanceCalendar.totalLateMinutes', 'Total Late Minutes')}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {applyVariables(t('attendanceCalendar.timeFormat', '{{hours}}h {{minutes}}m'), {
                    hours: String(Math.floor(processedEmployeeData.totalLateMinutes / 60)),
                    minutes: String(processedEmployeeData.totalLateMinutes % 60)
                  })}
                </div>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                <div className="text-lg sm:text-2xl font-bold text-red-600">{formatToRupiah(personalPenalties)}</div>
                <div className="text-xs sm:text-sm text-gray-600">{t('attendanceCalendar.totalPenaltyThisMonth', 'Total Penalty This Month')}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('attendanceCalendar.basedOnCompanyRules', 'Based on company rules')}
                </div>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 sm:col-span-2 lg:col-span-1">
                <div className="text-lg sm:text-2xl font-bold text-amber-600">{stats.T}</div>
                <div className="text-xs sm:text-sm text-gray-600">{t('attendanceCalendar.totalLateDays', 'Total Late Days')}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {applyVariables(t('attendanceCalendar.averagePerDay', 'Average: {{minutes}} minutes/day'), {
                    minutes: String(stats.T > 0 ? Math.round(processedEmployeeData.totalLateMinutes / stats.T) : 0)
                  })}
                </div>
              </div>
            </div>
            
            {/* Monthly Performance */}
            <div className="mt-4 bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
              <h5 className="text-sm font-medium text-gray-800 mb-2">{t('attendanceCalendar.monthlyPerformance', 'Monthly Attendance Performance')}</h5>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span>{applyVariables(t('attendanceCalendar.attendance', 'Attendance: {{rate}}%'), { rate: String(attendanceRate) })}</span>
                  <span>{applyVariables(t('attendanceCalendar.lateness', 'Lateness: {{rate}}%'), { rate: String(totalWorkingDays > 0 ? Math.round((stats.T / totalWorkingDays) * 100) : 0) })}</span>
                  <span>{applyVariables(t('attendanceCalendar.absence', 'Absence: {{rate}}%'), { rate: String(totalWorkingDays > 0 ? Math.round((stats.A / totalWorkingDays) * 100) : 0) })}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {getMonthName(currentMonth)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalAttendanceCalendar;

