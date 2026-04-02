import { ChangeEvent, useCallback } from 'react';
import { Search, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { AttendanceViewToggle } from '@/features/2-3-employee-attendance';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AttendanceToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  dateRange?: { from?: Date; to?: Date };
  onDateChange?: (value: { from?: Date; to?: Date }) => void;
  onOpenDatePicker?: () => void;
  dateRangeLabel?: string;
  onClear?: () => void;
  currentView: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}

export const AttendanceToolbar = ({
  searchTerm,
  onSearchChange,
  status,
  onStatusChange,
  dateRange,
  onDateChange,
  onOpenDatePicker,
  dateRangeLabel,
  onClear,
  currentView,
  onViewChange,
}: AttendanceToolbarProps) => {
  const { t } = useAppTranslation();
  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSearchChange(event.target.value);
    },
    [onSearchChange],
  );

  return (
    <div className="bg-card rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-1">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder={t('search.employeeName', 'Search employee name...')}
            value={searchTerm}
            onChange={handleSearch}
            className="h-9 w-full border-input pl-4 pr-10 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Search className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        </div>

        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-sm text-left">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
          </SelectContent>
        </Select>

        {onDateChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDatePicker}
            className="h-9 px-3 flex items-center gap-2 text-sm"
          >
            <CalendarIcon className="h-4 w-4" />
            {dateRange?.from && dateRange?.to
              ? dateRangeLabel ?? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
              : dateRangeLabel ?? t('datePicker.selectDateRange', 'Select date range')}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {onClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-9 px-3 flex items-center gap-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          )}
          <AttendanceViewToggle currentView={currentView} onViewChange={onViewChange} />
        </div>
      </div>
    </div>
  );
};

