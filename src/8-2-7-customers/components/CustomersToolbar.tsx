import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
};

export function CustomersToolbar({ search, onSearchChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{t('customers.tab.list', 'Customers List')}</h2>
      <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('customers.filters.search', 'Name, email, phone')}
          className="h-9 w-full pl-4 pr-10"
          aria-label={t('customers.filters.search', 'Name, email, phone')}
        />
      </div>
    </div>
  );
}
