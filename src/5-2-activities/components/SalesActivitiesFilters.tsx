import React from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SalesActivityDialog } from './SalesActivityDialog';
import {
  DEFAULT_SALES_ACTIVITIES_FILTERS,
  type SalesActivitiesFiltersState,
} from '../utils/salesActivitiesFilterUtils';
import { formatActivityTypeLabel, mergeActivityTypeGroups } from '../lib/salesActivityType';

interface SalesActivitiesFiltersProps {
  filters: SalesActivitiesFiltersState;
  onFiltersChange: (filters: SalesActivitiesFiltersState) => void;
  /** Unique activity_type values from the unfiltered page dataset. */
  activityTypes?: string[];
  /** Called after a new activity is saved from the filter-bar dialog (keeps list in sync). */
  onCreateSuccess?: () => void;
}

export const SalesActivitiesFilters = ({
  filters,
  onFiltersChange,
  activityTypes = [],
  onCreateSuccess,
}: SalesActivitiesFiltersProps) => {
  const { t } = useAppTranslation();
  const [showDialog, setShowDialog] = React.useState(false);
  const typeGroups = React.useMemo(() => mergeActivityTypeGroups(activityTypes), [activityTypes]);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onFiltersChange({ ...DEFAULT_SALES_ACTIVITIES_FILTERS });
  };

  const handleDialogSuccess = () => {
    setShowDialog(false);
    onCreateSuccess?.();
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Search activities..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-4 pr-10 h-9 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Status Filter */}
        <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Negotiating">Negotiating</SelectItem>
            <SelectItem value="Won">Won</SelectItem>
            <SelectItem value="Lost">Lost</SelectItem>
            <SelectItem value="Follow Up">Follow Up</SelectItem>
            <SelectItem value="Converted">Converted</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
            <SelectValue placeholder={t('salesActivities.filters.typePlaceholder', 'Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('salesActivities.filters.allTypes', 'All Types')}</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-xs text-gray-500 font-medium">
                {t('salesActivities.filters.groupSales', 'Sales')}
              </SelectLabel>
              {typeGroups.sales.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatActivityTypeLabel(type, t)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-xs text-gray-500 font-medium">
                {t('salesActivities.filters.groupStore', 'Store')}
              </SelectLabel>
              {typeGroups.store.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatActivityTypeLabel(type, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Payment Filter */}
        <Select value={filters.payment} onValueChange={(value) => handleFilterChange('payment', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="credit_card">Credit Card</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="e_wallet">E-Wallet</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Select value={filters.date} onValueChange={(value) => handleFilterChange('date', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        <button
          onClick={handleClear}
          className="h-9 px-3 hover:bg-gray-100 rounded-md transition-colors border border-gray-300 flex items-center justify-center"
          title="Clear all filters"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>

        {/* New Activity Button */}
        <Button 
          onClick={() => setShowDialog(true)}
          className="h-9 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Activity
        </Button>
      </div>

      <SalesActivityDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={handleDialogSuccess}
      />
    </>
  );
};
