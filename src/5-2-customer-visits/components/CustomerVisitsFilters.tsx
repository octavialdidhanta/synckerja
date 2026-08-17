import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, RefreshCw } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { CustomerVisitsSaleFilter } from '../lib/customerVisitSale';

export type CustomerVisitsFiltersState = {
  search: string;
  date: string;
  match: string;
  sale: CustomerVisitsSaleFilter;
};

export const DEFAULT_CUSTOMER_VISITS_FILTERS: CustomerVisitsFiltersState = {
  search: '',
  date: 'all',
  match: 'all',
  sale: 'all',
};

type Props = {
  filters: CustomerVisitsFiltersState;
  onFiltersChange: (filters: CustomerVisitsFiltersState) => void;
};

export function CustomerVisitsFilters({ filters, onFiltersChange }: Props) {
  const { t } = useAppTranslation();

  const set = (key: keyof CustomerVisitsFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[150px] flex-1">
        <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder={t('customerVisits.filters.search', 'Search visits…')}
          className="h-9 w-full rounded-md border border-gray-300 pl-4 pr-10 text-sm"
        />
      </div>
      <Select value={filters.date} onValueChange={(value) => set('date', value)}>
        <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('customerVisits.filters.allTime', 'All time')}</SelectItem>
          <SelectItem value="today">{t('customerVisits.filters.today', 'Today')}</SelectItem>
          <SelectItem value="this_week">{t('customerVisits.filters.thisWeek', 'This week')}</SelectItem>
          <SelectItem value="this_month">{t('customerVisits.filters.thisMonth', 'This month')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.match} onValueChange={(value) => set('match', value)}>
        <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('customerVisits.filters.allMatch', 'All matches')}</SelectItem>
          <SelectItem value="matched">{t('customerVisits.matchStatus.matched', 'Matched')}</SelectItem>
          <SelectItem value="unmatched">{t('customerVisits.matchStatus.unmatched', 'Unmatched')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.sale} onValueChange={(value) => set('sale', value)}>
        <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
          <SelectValue placeholder={t('customerVisits.filters.sale', 'Sale')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('customerVisits.filters.allSale', 'All sales')}</SelectItem>
          <SelectItem value="unpaid">{t('customerVisits.sale.unpaid', 'Unpaid')}</SelectItem>
          <SelectItem value="paid">{t('customerVisits.sale.paid', 'Paid')}</SelectItem>
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={() => onFiltersChange({ ...DEFAULT_CUSTOMER_VISITS_FILTERS })}
        className="flex h-9 items-center justify-center rounded-md border border-gray-300 px-3 hover:bg-gray-100"
        title={t('customerVisits.filters.clear', 'Clear filters')}
      >
        <RefreshCw className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
}
