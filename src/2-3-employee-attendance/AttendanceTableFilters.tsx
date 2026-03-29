
import { useState } from 'react';
import { Search, Filter, Download, Calendar } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar as CalendarComponent } from '@/shared/components/ui/calendar';
import { format } from 'date-fns';

interface AttendanceTableFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  onExport: () => void;
}

export const AttendanceTableFilters = ({
  searchTerm,
  onSearchChange,
  selectedDepartment,
  onDepartmentChange,
  dateRange,
  onDateRangeChange,
  onExport
}: AttendanceTableFiltersProps) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-200">
      {/* Quick Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 text-sm"
        />
      </div>

      {/* Department Filter */}
      <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-40 text-sm">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          <SelectItem value="it">IT</SelectItem>
          <SelectItem value="hr">HR</SelectItem>
          <SelectItem value="finance">Finance</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Picker */}
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="text-sm font-normal">
            <Calendar className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
              ) : (
                format(dateRange.from, 'MMM dd, yyyy')
              )
            ) : (
              'Select date range'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange({
                from: range?.from,
                to: range?.to
              });
              if (range?.from && range?.to) {
                setIsDatePickerOpen(false);
              }
            }}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Export Options */}
      <Button variant="outline" size="sm" onClick={onExport} className="text-sm">
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  );
};
