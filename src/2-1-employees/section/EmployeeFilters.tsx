import { Search, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import type { EmployeeFilters as FilterType } from '../utils/employeeUtils';

interface EmployeeFiltersProps {
  filters: FilterType;
  departments: string[];
  positions: string[];
  onFilterChange: (key: keyof FilterType, value: string) => void;
  onClearFilters: () => void;
}

export const EmployeeFilters = ({
  filters,
  departments,
  positions,
  onFilterChange,
  onClearFilters
}: EmployeeFiltersProps) => {
  const hasActiveFilters = 
    filters.search ||
    filters.department !== 'all' ||
    filters.position !== 'all' ||
    filters.status !== 'all' ||
    filters.employmentType !== 'all' ||
    filters.timePeriod !== 'all';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search employees..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="h-9 w-full rounded-md border border-border pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>

        {/* Department Filter */}
        <Select
          value={filters.department || 'all'}
          onValueChange={(value) => onFilterChange('department', value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept.toLowerCase().trim()}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Position Filter */}
        <Select
          value={filters.position || 'all'}
          onValueChange={(value) => onFilterChange('position', value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {positions.map(pos => (
              <SelectItem key={pos} value={pos.toLowerCase().trim()}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending-removal">Pending Removal</SelectItem>
            <SelectItem value="on-leave">On Leave</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>

        {/* Employment Type Filter */}
        <Select
          value={filters.employmentType || 'all'}
          onValueChange={(value) => onFilterChange('employmentType', value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Employment Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="full-time">Full Time</SelectItem>
            <SelectItem value="part-time">Part Time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="freelance">Freelance</SelectItem>
          </SelectContent>
        </Select>

        {/* Time Filter */}
        <Select
          value={filters.timePeriod || 'all'}
          onValueChange={(value) => onFilterChange('timePeriod', value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            <SelectItem value="last_6_months">Last 6 Months</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="last_year">Last Year</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        <button
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className={`flex h-9 items-center justify-center rounded-md border border-border px-3 transition-colors ${
            hasActiveFilters
              ? "cursor-pointer hover:bg-brand-blue/10 hover:text-brand-blue"
              : "cursor-not-allowed opacity-50"
          }`}
          title="Clear all filters"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};
