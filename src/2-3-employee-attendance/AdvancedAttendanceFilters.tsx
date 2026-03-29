
import { useState } from 'react';
import { Search, Filter, Download, Calendar, Users, MapPin, Clock, AlertTriangle, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar as CalendarComponent } from '@/shared/components/ui/calendar';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { format } from 'date-fns';

interface FilterState {
  searchTerm: string;
  selectedDepartment: string;
  selectedStatus: string[];
  selectedWorkType: string[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  workHoursRange: { min: number; max: number };
  scoreRange: { min: number; max: number };
  locationFilter: string;
  flagsFilter: string[];
  showOnlyFlagged: boolean;
}

interface AdvancedAttendanceFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onExport: () => void;
  onClearFilters: () => void;
}

export const AdvancedAttendanceFilters = ({
  filters,
  onFiltersChange,
  onExport,
  onClearFilters
}: AdvancedAttendanceFiltersProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'selectedStatus' | 'selectedWorkType' | 'flagsFilter', value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'searchTerm') return value.length > 0;
    if (key === 'selectedDepartment') return value !== 'all';
    if (key === 'selectedStatus' || key === 'selectedWorkType' || key === 'flagsFilter') return (value as string[]).length > 0;
    if (key === 'dateRange') return (value as any).from || (value as any).to;
    if (key === 'workHoursRange') return (value as any).min > 0 || (value as any).max < 24;
    if (key === 'scoreRange') return (value as any).min > 0 || (value as any).max < 100;
    if (key === 'locationFilter') return value.length > 0;
    if (key === 'showOnlyFlagged') return value;
    return false;
  }).length;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Primary Filters Row */}
      <div className="flex items-center gap-3 p-4">
        {/* Quick Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search employees..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        {/* Department Filter */}
        <Select value={filters.selectedDepartment} onValueChange={(value) => updateFilter('selectedDepartment', value)}>
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
              {filters.dateRange.from ? (
                filters.dateRange.to ? (
                  `${format(filters.dateRange.from, 'MMM dd')} - ${format(filters.dateRange.to, 'MMM dd')}`
                ) : (
                  format(filters.dateRange.from, 'MMM dd, yyyy')
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
              defaultMonth={filters.dateRange.from}
              selected={filters.dateRange}
              onSelect={(range) => {
                updateFilter('dateRange', {
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

        {/* Advanced Filters Toggle */}
        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="text-sm">
              <Filter className="mr-2 h-4 w-4" />
              Advanced
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs bg-blue-600">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Advanced Filters</h3>
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="space-y-2">
                  {['present', 'late', 'absent', 'wfh'].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        checked={filters.selectedStatus.includes(status)}
                        onCheckedChange={() => toggleArrayFilter('selectedStatus', status)}
                      />
                      <label className="text-sm capitalize">{status}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Work Type</label>
                <div className="space-y-2">
                  {['hybrid', 'onsite', 'wfh'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        checked={filters.selectedWorkType.includes(type)}
                        onCheckedChange={() => toggleArrayFilter('selectedWorkType', type)}
                      />
                      <label className="text-sm capitalize">{type}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Location</label>
                <Input
                  placeholder="Filter by location..."
                  value={filters.locationFilter}
                  onChange={(e) => updateFilter('locationFilter', e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Work Hours Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Work Hours Range</label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.workHoursRange.min || ''}
                    onChange={(e) => updateFilter('workHoursRange', { ...filters.workHoursRange, min: Number(e.target.value) || 0 })}
                    className="text-sm w-20"
                    min="0"
                    max="24"
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.workHoursRange.max || ''}
                    onChange={(e) => updateFilter('workHoursRange', { ...filters.workHoursRange, max: Number(e.target.value) || 24 })}
                    className="text-sm w-20"
                    min="0"
                    max="24"
                  />
                  <span className="text-xs text-gray-500">hours</span>
                </div>
              </div>

              {/* Score Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Performance Score Range</label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.scoreRange.min || ''}
                    onChange={(e) => updateFilter('scoreRange', { ...filters.scoreRange, min: Number(e.target.value) || 0 })}
                    className="text-sm w-20"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.scoreRange.max || ''}
                    onChange={(e) => updateFilter('scoreRange', { ...filters.scoreRange, max: Number(e.target.value) || 100 })}
                    className="text-sm w-20"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* Flags Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Validation Flags</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.showOnlyFlagged}
                      onCheckedChange={(checked) => updateFilter('showOnlyFlagged', checked)}
                    />
                    <label className="text-sm">Show only flagged records</label>
                  </div>
                  {['late_pattern', 'excessive_hours', 'weekend_work', 'missing_checkout'].map((flag) => (
                    <div key={flag} className="flex items-center space-x-2">
                      <Checkbox
                        checked={filters.flagsFilter.includes(flag)}
                        onCheckedChange={() => toggleArrayFilter('flagsFilter', flag)}
                      />
                      <label className="text-sm">{flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Export Options */}
        <Button variant="outline" size="sm" onClick={onExport} className="text-sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Active filters:</span>
          {filters.selectedDepartment !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Dept: {filters.selectedDepartment}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => updateFilter('selectedDepartment', 'all')} />
            </Badge>
          )}
          {filters.selectedStatus.map((status) => (
            <Badge key={status} variant="secondary" className="text-xs">
              Status: {status}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => toggleArrayFilter('selectedStatus', status)} />
            </Badge>
          ))}
          {filters.selectedWorkType.map((type) => (
            <Badge key={type} variant="secondary" className="text-xs">
              Type: {type}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => toggleArrayFilter('selectedWorkType', type)} />
            </Badge>
          ))}
          {filters.showOnlyFlagged && (
            <Badge variant="secondary" className="text-xs">
              Only Flagged
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => updateFilter('showOnlyFlagged', false)} />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs h-6">
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
};
