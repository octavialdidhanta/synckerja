import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  totalCustomers: number;
  filteredCustomers: number;
};

export function CustomersTableFooter({ totalCustomers, filteredCustomers }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t bg-gray-50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {t('customers.table.showing', 'Showing {{filtered}} of {{total}} customers', {
            filtered: filteredCustomers,
            total: totalCustomers,
          })}
        </span>
      </div>
    </div>
  );
}
