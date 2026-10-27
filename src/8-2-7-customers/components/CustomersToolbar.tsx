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
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t('customers.tab.list', 'Customers List')}
      </h2>
      <div className="min-w-0 flex-1" aria-hidden />
      <div className="relative w-[280px] shrink-0">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('customers.filters.search', 'Name, email, phone')}
          className="h-10 w-full pl-4 pr-10"
          aria-label={t('customers.filters.search', 'Name, email, phone')}
        />
      </div>
    </div>
  );
}
