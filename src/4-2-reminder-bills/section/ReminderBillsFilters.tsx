import { Search, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export interface ReminderBillsFiltersType {
  search: string;
  status: string;
  category: string;
  department: string;
  /** `all` | `this_month` | `last_month` | `this_year` — `next_payment_date` lalu `create_date`. */
  period: string;
}

interface ReminderBillsFiltersProps {
  filters: ReminderBillsFiltersType;
  onFilterChange: (key: keyof ReminderBillsFiltersType, value: string) => void;
  onClearFilters: () => void;
}

export const ReminderBillsFilters = ({
  filters,
  onFilterChange,
  onClearFilters
}: ReminderBillsFiltersProps) => {
  const hasActiveFilters =
    filters.search ||
    filters.status !== 'all' ||
    filters.category !== 'all' ||
    filters.department !== 'all' ||
    (filters.period && filters.period !== 'all');

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Search bills..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-4 pr-10 h-9 text-sm"
          />
        </div>

        <Select
          value={filters.period || 'all'}
          onValueChange={(value) => onFilterChange('period', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="this_year">This year</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => onFilterChange('category', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="utilities">Utilities</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="software">Software</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>

        {/* Department Filter */}
        <Select
          value={filters.department || 'all'}
          onValueChange={(value) => onFilterChange('department', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="it">IT</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="operations">Operations</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-3 text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};
