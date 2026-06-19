import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { SalesActivity } from '@/shared/hooks/organized/sales';

type PiutangTableFooterProps = {
  totalActivities: number;
  filteredRows: SalesActivity[];
};

export function PiutangTableFooter({ totalActivities, filteredRows }: PiutangTableFooterProps) {
  const { t } = useAppTranslation();
  const filtered = filteredRows.length;

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t(
            'incomes.piutang.tableFooter.showing',
            'Showing {{filtered}} of {{total}} activities',
            { filtered, total: totalActivities },
          )}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.piutang.tableFooter.total', 'Total: {{total}} activities', {
            total: totalActivities,
          })}
        </span>
      </div>
    </div>
  );
}
