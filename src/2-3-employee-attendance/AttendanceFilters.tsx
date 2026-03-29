import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AttendanceToolbar } from '@/features/2-3-attendance/section/AttendanceToolbar';
import { AttendanceDateRangePicker } from '@/shared/calendar/AttendanceDateRangePicker';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface FilterState {
  searchTerm: string;
  status: string;
  selectedStatus: string[];
  selectedWorkType: string[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  workHoursRange: { min: number; max: number };
  scoreRange: { min: number; max: number };
  locationFilter: string;
  flagsFilter: string[];
  showOnlyFlagged: boolean;
}

export const createDefaultFilterState = (): FilterState => ({
  searchTerm: '',
  status: 'all',
  selectedStatus: [],
  selectedWorkType: [],
  dateRange: { from: undefined, to: undefined },
  workHoursRange: { min: 0, max: 24 },
  scoreRange: { min: 0, max: 100 },
  locationFilter: '',
  flagsFilter: [],
  showOnlyFlagged: false
});

interface AttendanceFiltersProps {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  currentView: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}

export const AttendanceFilters = ({
  filters,
  setFilters,
  currentView,
  onViewChange
}: AttendanceFiltersProps) => {
  const { t } = useAppTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSearchChange = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, searchTerm: value }));
    },
    [setFilters]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, status: value }));
    },
    [setFilters]
  );

  const handleDateChange = useCallback(
    (value: { from?: Date; to?: Date }) => {
      setFilters((prev) => ({ ...prev, dateRange: { from: value.from, to: value.to } }));
    },
    [setFilters]
  );

  const formattedDateRange = useMemo(() => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'dd MMM yyyy')} - ${format(filters.dateRange.to, 'dd MMM yyyy')}`;
    }
    return t('datePicker.selectDateRange', 'Select date range');
  }, [filters.dateRange.from, filters.dateRange.to, t]);

  const handleClearFilters = useCallback(() => {
    setFilters(createDefaultFilterState());
  }, [setFilters]);

  return (
    <>
      <AttendanceToolbar
        searchTerm={filters.searchTerm}
        onSearchChange={handleSearchChange}
        status={filters.status}
        onStatusChange={handleStatusChange}
        dateRange={filters.dateRange}
        onDateChange={handleDateChange}
        onOpenDatePicker={() => setShowDatePicker(true)}
        dateRangeLabel={formattedDateRange}
        onClear={handleClearFilters}
        currentView={currentView}
        onViewChange={onViewChange}
      />

      <AttendanceDateRangePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onDateRangeSelect={(startDate, endDate) => {
          handleDateChange({ from: startDate, to: endDate });
        }}
        initialStartDate={filters.dateRange.from}
        initialEndDate={filters.dateRange.to}
      />
    </>
  );
};

export default AttendanceFilters;

