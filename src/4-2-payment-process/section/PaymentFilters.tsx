import { Search, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export interface PaymentFiltersType {
  search: string;
  status: string;
  type: string;
  department: string;
  /** `all` | `this_month` | `last_month` | `this_year` — disaring di `filterPaymentRequests` (tanggal acuan: `approved_at` lalu `created_at`). */
  period: string;
}

interface PaymentFiltersProps {
  filters: PaymentFiltersType;
  onFilterChange: (key: keyof PaymentFiltersType, value: string) => void;
  onClearFilters: () => void;
}

export const PaymentFilters = ({
  filters,
  onFilterChange,
  onClearFilters
}: PaymentFiltersProps) => {
  const hasActiveFilters =
    filters.search ||
    filters.status !== 'all' ||
    filters.type !== 'all' ||
    filters.department !== 'all' ||
    (filters.period && filters.period !== 'all');

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 text-muted-foreground/70 absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Search payments..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-4 pr-10 h-9 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm"
          />
        </div>

        {/* Period (desktop; mobile memakai drawer di shell khusus) */}
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={filters.type || 'all'}
          onValueChange={(value) => onFilterChange('type', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="reimbursement">Reimbursement</SelectItem>
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
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
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
