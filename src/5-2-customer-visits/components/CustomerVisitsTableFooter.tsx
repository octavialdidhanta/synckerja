import { SALES_OPS_CARD_FOOTER } from '@/5-2-activities/layout/salesOperationsLayout';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  totalVisits: number;
  filteredVisits: number;
};

export function CustomerVisitsTableFooter({ totalVisits, filteredVisits }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className={SALES_OPS_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {t('customerVisits.table.showing', 'Showing {{filtered}} of {{total}} visits', {
            filtered: filteredVisits,
            total: totalVisits,
          })}
        </span>
        <span className="text-xs text-gray-400">
          {t('customerVisits.table.total', 'Total: {{total}} visits', { total: totalVisits })}
        </span>
      </div>
    </div>
  );
}
