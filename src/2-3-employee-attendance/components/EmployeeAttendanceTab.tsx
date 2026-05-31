
import { useState, useCallback } from 'react';
import AttendanceCalendarView from './AttendanceCalendarView';
import { EnhancedAttendanceSidebar } from './EnhancedAttendanceSidebar';
import { AttendanceFilters, createDefaultFilterState, type FilterState } from './AttendanceFilters';
import { EmployeeAttendanceDetailPanel } from './EmployeeAttendanceDetailPanel';

export type SelectedAttendanceEmployee = { id: string; name: string } | null;

const EmployeeAttendanceTab = () => {
  const [filters, setFilters] = useState<FilterState>(createDefaultFilterState);
  const [selectedEmployee, setSelectedEmployee] = useState<SelectedAttendanceEmployee>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const handleEmployeeSelect = useCallback((employee: SelectedAttendanceEmployee) => {
    setSelectedEmployee(employee);
  }, []);

  const handleMonthChange = useCallback((month: number, year: number) => {
    setCalendarMonth(month);
    setCalendarYear(year);
    setSelectedEmployee(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEmployee(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex min-h-0 flex-col xl:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <AttendanceFilters filters={filters} setFilters={setFilters} />
            <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border shadow-sm">
              {selectedEmployee ? (
                <EmployeeAttendanceDetailPanel
                  employeeId={selectedEmployee.id}
                  employeeName={selectedEmployee.name}
                  month={calendarMonth}
                  year={calendarYear}
                  searchTerm={filters.searchTerm}
                  status={filters.status}
                  onClose={handleCloseDetail}
                />
              ) : (
                <AttendanceCalendarView
                  searchTerm={filters.searchTerm}
                  status={filters.status}
                  dateRange={filters.dateRange}
                  selectedEmployeeId={null}
                  onEmployeeSelect={handleEmployeeSelect}
                  onMonthChange={handleMonthChange}
                />
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col xl:col-span-3">
          <div className="bg-card flex h-full min-h-0 flex-col rounded-lg border border-border shadow-sm">
            <div className="flex-1 min-h-0">
              <div className="h-full min-h-0 px-6 py-4">
                <EnhancedAttendanceSidebar selectedRows={[]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendanceTab;
