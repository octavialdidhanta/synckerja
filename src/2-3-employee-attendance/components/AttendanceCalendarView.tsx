import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatToRupiah } from '@/2-1-employees/MyInfo/Attendance/utils/formatCurrency';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { getEmployeeStatus } from '@/2-1-employees/utils/employeeUtils';
import { useAttendanceRecords } from '@/2-1-employees/MyInfo/Attendance/hooks/useAttendanceRecords';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  useOptimizedNationalHolidays,
  useOptimizedWorkSchedules,
} from '@/2-1-employees/MyInfo/Attendance/hooks/useOptimizedAttendanceData';
import { useAttendancePenaltyTotal } from '@/2-1-employees/MyInfo/Attendance/hooks/useAttendancePenaltyTotal';
import { EmployeePenaltyCell } from './EmployeePenaltyCell';
import { useQueryClient } from '@tanstack/react-query';
import { useLeaveRequests } from '@/2-1-employees/MyInfo/Attendance/hooks/useLeaveRequests';
import { attendanceLoadSectionIds, useReportAttendanceSection } from '@/2-3-attendance/context/AttendancePageLoadContext';

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getMonthName = (month: number) => {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[month];
};

const getDayName = (date: number, month: number, year: number) => {
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dayIndex = new Date(year, month, date).getDay();
  return dayNames[dayIndex];
};

const isNonWorkingDay = (date: number, month: number, year: number, workingDays: number[] = [1, 2, 3, 4, 5], nationalHolidays: any[] = []) => {
  const dayIndex = new Date(year, month, date).getDay();
  // Convert Sunday from 0 to 7 to match our working_days format (1=Mon, 7=Sun)
  const adjustedDayIndex = dayIndex === 0 ? 7 : dayIndex;
  
  // First check if it's a national holiday (this takes priority over regular work schedule)
  // Create date in local timezone to avoid timezone offset issues
  const currentDate = new Date(year, month, date);
  // Format as YYYY-MM-DD in local timezone to match database format
  const localYear = currentDate.getFullYear();
  const localMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const localDay = String(currentDate.getDate()).padStart(2, '0');
  const dateString = `${localYear}-${localMonth}-${localDay}`;
  
  // Also check for same date/month regardless of year (for recurring holidays)
  const monthDayString = `${localMonth}-${localDay}`;
  
  const isNationalHoliday = nationalHolidays.some(holiday => {
    if (!holiday.is_active || !holiday.applies_to_attendance) return false;
    
    // Exact date match (with year)
    if (holiday.date === dateString) return true;
    
    // For holidays that should recur yearly, match month-day regardless of year
    const holidayDate = new Date(holiday.date);
    const holidayMonth = String(holidayDate.getMonth() + 1).padStart(2, '0');
    const holidayDay = String(holidayDate.getDate()).padStart(2, '0');
    const holidayMonthDay = `${holidayMonth}-${holidayDay}`;
    
    // If holiday is marked as recurring OR if it's a national holiday, apply to any year
    if (holiday.is_recurring || holiday.country_code) {
      return holidayMonthDay === monthDayString;
    }
    
    return false;
  });
  
  // If it's an active national holiday, it's definitely a non-working day
  if (isNationalHoliday) {
    return true;
  }
  
  // Otherwise, check regular work schedule
  const isNonScheduledWorkDay = !workingDays.includes(adjustedDayIndex);
  
  return isNonScheduledWorkDay;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'H':
      return 'bg-emerald-200 text-emerald-800 border-emerald-300';
    case 'I':
      return 'bg-blue-200 text-blue-800 border-blue-300';
    case 'S':
      return 'bg-yellow-200 text-yellow-800 border-yellow-300';
    case 'C':
      return 'bg-orange-200 text-orange-800 border-orange-300';
    case 'A':
      return 'bg-red-200 text-red-800 border-red-300';
    case 'T':
      return 'bg-purple-200 text-purple-800 border-purple-300';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

interface AttendanceCalendarViewProps {
  searchTerm: string;
  status: string;
  dateRange?: { from?: Date; to?: Date };
}

const AttendanceCalendarView = ({ searchTerm, status: _status, dateRange: _dateRange }: AttendanceCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date()); // Bulan yang sedang berjalan (saat ini)
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const queryClient = useQueryClient();
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const { data: workScheduleSettings = [], isPending: scheduleLoading } = useOptimizedWorkSchedules();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { records: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceRecords(
    organizationId ?? undefined,
  );
  const { data: nationalHolidays = [], isLoading: holidaysLoading } = useOptimizedNationalHolidays();
  const { data: leaveRequests = [], isPending: leavePending } = useLeaveRequests({
    month: currentMonth + 1,
    year: currentYear
  });

  const calendarBootLoading =
    orgLoading ||
    scheduleLoading ||
    employeesLoading ||
    attendanceLoading ||
    holidaysLoading ||
    leavePending;
  useReportAttendanceSection(attendanceLoadSectionIds.attendanceCalendar, calendarBootLoading);
  
  // Get total penalty amount for all employees in current month
  const { data: totalMonthlyPenalties = 0 } = useAttendancePenaltyTotal(undefined, currentMonth, currentYear);
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  
  // Get default work schedule or first available schedule
  const defaultSchedule = workScheduleSettings.find(schedule => schedule.is_default) || workScheduleSettings[0];
  const workingDays = defaultSchedule?.working_days || [1, 2, 3, 4, 5, 6, 7]; // Default: All days if no schedule
  
  // Debug: Log work schedule settings and holidays to ensure synchronization
  useEffect(() => {
    console.log('📋 Work Schedule & Holiday Settings Updated:', {
      settingsCount: workScheduleSettings.length,
      defaultSchedule: defaultSchedule?.name,
      workingDays: workingDays,
      workingDaysArray: Array.isArray(workingDays) ? workingDays : 'NOT_ARRAY',
      nationalHolidaysCount: nationalHolidays.length,
      activeHolidays: nationalHolidays.filter(h => h.is_active).length,
      scheduleSettings: workScheduleSettings,
      currentMonthHolidays: nationalHolidays.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getMonth() === currentMonth && holidayDate.getFullYear() === currentYear && holiday.is_active;
      }),
      // Test specific dates untuk hari libur Juni 2024
      june1IsNonWorking: isNonWorkingDay(1, currentMonth, currentYear, workingDays, nationalHolidays),
      june17IsNonWorking: isNonWorkingDay(17, currentMonth, currentYear, workingDays, nationalHolidays),
      // Holiday details for debugging
      holidayDetails: nationalHolidays.map(h => ({
        name: h.name,
        date: h.date,
        is_active: h.is_active,
        applies_to_attendance: h.applies_to_attendance
      }))
    });
  }, [workScheduleSettings, defaultSchedule, workingDays, nationalHolidays, currentMonth, currentYear]);

  // Refresh holiday data when page loads to ensure latest status
  useEffect(() => {
    const refreshHolidayData = () => {
      queryClient.invalidateQueries({ 
        queryKey: ['attendance', 'national-holidays', organizationId] 
      });
    };
    
    // Refresh immediately when component mounts
    refreshHolidayData();
    
    // Set up interval to refresh holiday data every 10 seconds to catch toggle changes quickly
    const interval = setInterval(refreshHolidayData, 10000);
    
    return () => clearInterval(interval);
  }, [queryClient, organizationId]);
  
  // Listen for focus events to refresh data when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries({ 
        queryKey: ['attendance', 'national-holidays', organizationId] 
      });
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient, organizationId]);
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Filter out terminated employees first
  const activeEmployees = useMemo(() => {
    return employees.filter(employee => {
      const status = getEmployeeStatus(employee);
      return status.toLowerCase() !== 'terminated';
    });
  }, [employees]);

  // Process attendance data for calendar view
  const processedEmployees = useMemo(() => {
    return activeEmployees.map(employee => {
      const attendanceData: { [key: number]: string } = {};
      let totalLateMinutes = 0; // Track total late minutes for this employee
      
      // Group attendance records by employee and process them
      const employeeRecords = attendanceRecords.filter(record => 
        record.employees?.id === employee.id ||
        record.employee_id === employee.id
      );
      
      employeeRecords.forEach(record => {
        const recordDate = new Date(record.attendance_date);
        if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
          const day = recordDate.getDate();
          
          // Sum up late minutes for the month
          if (record.is_late && record.late_minutes && record.late_minutes > 0) {
            totalLateMinutes += record.late_minutes;
          }
          
          // Convert status to calendar format
          if (record.is_late && record.late_minutes && record.late_minutes > 0) {
            attendanceData[day] = 'T'; // Terlambat
          } else if (record.status === 'present') {
            attendanceData[day] = 'H'; // Hadir
          } else if (record.status === 'absent') {
            attendanceData[day] = 'A'; // Alfa
          } else if (record.status === 'sick') {
            attendanceData[day] = 'S'; // Sakit
          } else if (record.status === 'leave') {
            attendanceData[day] = 'C'; // Cuti
          } else if (record.status === 'permission') {
            attendanceData[day] = 'I'; // Izin
          }
        }
      });

      // Process approved leave requests for the employee
      const employeeLeaveRequests = leaveRequests.filter(leave => 
        leave.employee_id === employee.id && leave.status === 'approved'
      );
      
      employeeLeaveRequests.forEach(leave => {
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        
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
        id: employee.id,
        name: employee.full_name,
        attendanceData,
        totalLateMinutes // Add this to track total late minutes
      };
    });
  }, [activeEmployees, attendanceRecords, leaveRequests, currentMonth, currentYear]);

  const filteredEmployees = processedEmployees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate working days in current month
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

  // Calculate statistics
  const calculateStats = (attendanceData: any) => {
    const stats = { H: 0, A: 0, C: 0, I: 0, S: 0, T: 0 };
    Object.values(attendanceData).forEach((status: any) => {
      if (stats.hasOwnProperty(status)) {
        stats[status as keyof typeof stats]++;
      }
    });
    return stats;
  };

  // Calculate penalty amount based on attendance violations (sync version for now)
  const calculatePenaltyAmount = (attendanceData: any) => {
    let totalPenalty = 0;
    const stats = calculateStats(attendanceData);
    
    // For now, use basic calculation - TODO: integrate with real penalty rules
    // This will be enhanced with async penalty rules fetching in a future update
    totalPenalty += stats.A * 50000; // Alfa: 50k per absence
    totalPenalty += stats.T * 25000; // Terlambat: 25k per late
    
    // TODO: Add integration with penalty_rules and penalty_settings tables
    // This could be done via a custom hook that fetches and caches penalty rules
    
    return totalPenalty;
  };

  if (calendarBootLoading) {
    return null;
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-800">
              {getMonthName(currentMonth)} {currentYear}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-300 bg-emerald-200 text-xs font-medium text-emerald-800">
                H
              </span>
              <span className="text-gray-600">Hadir</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-blue-300 bg-blue-200 text-xs font-medium text-blue-800">
                I
              </span>
              <span className="text-gray-600">Izin</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-yellow-300 bg-yellow-200 text-xs font-medium text-yellow-800">
                S
              </span>
              <span className="text-gray-600">Sakit</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-orange-300 bg-orange-200 text-xs font-medium text-orange-800">
                C
              </span>
              <span className="text-gray-600">Cuti</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-red-300 bg-red-200 text-xs font-medium text-red-800">
                A
              </span>
              <span className="text-gray-600">Alfa</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-purple-300 bg-purple-200 text-xs font-medium text-purple-800">
                T
              </span>
              <span className="text-gray-600">Terlambat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Header Row */}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[200px] border border-gray-200 bg-slate-700 p-3 text-left text-sm font-bold text-white">
                Nama Karyawan
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = i + 1;
                const isNonWorking = isNonWorkingDay(date, currentMonth, currentYear, workingDays, nationalHolidays);
                return (
                  <th
                    key={date}
                    className={`min-w-[40px] max-w-[40px] w-[40px] border border-gray-200 p-2 text-center text-xs font-medium ${
                      isNonWorking ? 'bg-rose-400 text-white' : 'bg-slate-700 text-white'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{date.toString().padStart(2, '0')}</span>
                      <span className="text-xs font-normal">{getDayName(date, currentMonth, currentYear)}</span>
                    </div>
                  </th>
                );
              })}
              {/* Summary Columns */}
              <th className="min-w-[40px] border border-gray-200 bg-emerald-600 p-2 text-center text-xs font-bold text-white">H</th>
              <th className="min-w-[40px] border border-gray-200 bg-red-600 p-2 text-center text-xs font-bold text-white">A</th>
              <th className="min-w-[40px] border border-gray-200 bg-orange-600 p-2 text-center text-xs font-bold text-white">C</th>
              <th className="min-w-[40px] border border-gray-200 bg-blue-600 p-2 text-center text-xs font-bold text-white">I</th>
              <th className="min-w-[40px] border border-gray-200 bg-yellow-600 p-2 text-center text-xs font-bold text-white">S</th>
              <th className="min-w-[40px] border border-gray-200 bg-purple-600 p-2 text-center text-xs font-bold text-white">T</th>
              <th className="min-w-[48px] border border-gray-200 bg-slate-600 p-2 text-center text-xs font-bold text-white">Mnt</th>
              <th className="min-w-[60px] border border-gray-200 bg-slate-600 p-2 text-center text-xs font-bold text-white">Denda</th>
              <th className="min-w-[180px] border border-gray-200 bg-slate-600 p-2 text-center text-xs font-bold text-white">Kehadiran</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee, index) => {
              const attendanceData = employee.attendanceData || {};
              const stats = calculateStats(attendanceData);
              const attendanceRate = stats.H > 0 ? Math.round((stats.H / 23) * 100) : 0;
              const penaltyAmount = calculatePenaltyAmount(attendanceData);
              const isEvenRow = index % 2 === 0;

              return (
                <tr key={employee.id} className={isEvenRow ? 'bg-white' : 'bg-slate-50'}>
                  <td className="sticky left-0 z-10 border border-gray-200 bg-inherit p-3 text-sm font-bold text-gray-800">
                    {employee.name}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const date = i + 1;
                    const status = attendanceData[date];
                    const isNonWorking = isNonWorkingDay(date, currentMonth, currentYear, workingDays, nationalHolidays);

                    return (
                      <td
                        key={date}
                        className={`h-[40px] w-[40px] border border-gray-200 p-0 text-center ${
                          isNonWorking ? 'bg-rose-50' : status ? getStatusColor(status) : 'bg-white'
                        }`}
                      >
                        {status && (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-current">
                            {status}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {/* Summary Columns */}
                  <td className="border border-gray-200 bg-emerald-50 p-2 text-center text-sm font-medium text-emerald-700">
                    {stats.H}
                  </td>
                  <td className="border border-gray-200 bg-red-50 p-2 text-center text-sm font-medium text-red-700">
                    {stats.A}
                  </td>
                  <td className="border border-gray-200 bg-orange-50 p-2 text-center text-sm font-medium text-orange-700">
                    {stats.C}
                  </td>
                  <td className="border border-gray-200 bg-blue-50 p-2 text-center text-sm font-medium text-blue-700">
                    {stats.I}
                  </td>
                  <td className="border border-gray-200 bg-yellow-50 p-2 text-center text-sm font-medium text-yellow-700">
                    {stats.S}
                  </td>
                  <td className="border border-gray-200 bg-purple-50 p-2 text-center text-sm font-medium text-purple-700">
                    {stats.T}
                  </td>
                  <td className="border border-gray-200 bg-slate-50 p-2 text-center text-sm font-medium">
                    {employee.totalLateMinutes || 0}
                  </td>
                  <EmployeePenaltyCell
                    employeeId={employee.id}
                    month={currentMonth}
                    year={currentYear}
                    fallbackAmount={penaltyAmount}
                  />
                  <td className="min-w-[180px] border border-gray-200 bg-slate-50 p-3 text-center">
                    <div className="flex items-center gap-2">
                      <div className="h-4 min-w-[90px] flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-4 rounded-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${attendanceRate}%` }}
                        />
                      </div>
                      <span className="min-w-[35px] text-xs font-medium">{attendanceRate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="mt-auto border-t border-gray-200 bg-slate-50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <span>
            Total Karyawan: <strong className="text-gray-800">{employees.length}</strong>
          </span>
          <span>
            Hari Kerja: <strong className="text-gray-800">{totalWorkingDays}</strong>
          </span>
          <span>
            Tingkat Kehadiran: <strong className="text-emerald-600">3.0%</strong>
          </span>
          <span>
            Total Denda Bulan Ini: <strong className="text-red-600">{formatToRupiah(totalMonthlyPenalties)}</strong>
          </span>
          {defaultSchedule && (
            <span>
              Jadwal: <strong className="text-blue-600">{defaultSchedule.name}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendarView;
