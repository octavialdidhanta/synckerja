import { Search, RefreshCw } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export interface IncomeTransactionFilters {
  search: string;
  status: string;
  type: string;
  category: string;
  allocation: string;
}

interface IncomeTransactionFiltersProps {
  filters: IncomeTransactionFilters;
  onFilterChange: (key: keyof IncomeTransactionFilters, value: string) => void;
  onClearFilters: () => void;
}

export const IncomeTransactionFilters = ({
  filters,
  onFilterChange,
  onClearFilters
}: IncomeTransactionFiltersProps) => {
  const { t } = useAppTranslation();
  const hasActiveFilters = 
    filters.search ||
    filters.status !== 'all' ||
    filters.type !== 'all' ||
    filters.category !== 'all' ||
    filters.allocation !== 'all';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Search transactions..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-4 pr-10 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-gray-700 placeholder:text-gray-700 text-left">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">{t('incomes.deposit.statusCompleted', 'Completed')}</SelectItem>
            <SelectItem value="deposited">{t('incomes.deposit.statusDeposited', 'Uang masuk')}</SelectItem>
            <SelectItem value="pending">{t('incomes.deposit.statusPending', 'Menunggu deposit')}</SelectItem>
            <SelectItem value="cancelled">{t('incomes.deposit.statusCancelled', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={filters.type || 'all'}
          onValueChange={(value) => onFilterChange('type', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-gray-700 placeholder:text-gray-700 text-left">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>

        {/* Allocation Filter */}
        <Select
          value={filters.allocation || 'all'}
          onValueChange={(value) => onFilterChange('allocation', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-44 h-9 text-sm text-gray-700 placeholder:text-gray-700 text-left">
            <SelectValue placeholder={t('incomes.allocation.filterLabel', 'Allocation')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('incomes.allocation.filterAll', 'All allocation')}</SelectItem>
            <SelectItem value="needs_allocation">
              {t('incomes.allocation.filterNeeds', 'Needs allocation')}
            </SelectItem>
            <SelectItem value="complete">{t('incomes.allocation.filterComplete', 'Complete')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => onFilterChange('category', value)}
        >
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-gray-700 placeholder:text-gray-700 text-left">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="consulting">Consulting</SelectItem>
            <SelectItem value="other">Other</SelectItem>
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
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

