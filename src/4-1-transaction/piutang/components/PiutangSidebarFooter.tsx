import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { SalesActivity } from '@/shared/hooks/organized/sales';

type PiutangSidebarFooterProps = {
  filteredRows: SalesActivity[];
  totalActivities: number;
};

export function PiutangSidebarFooter({ filteredRows, totalActivities }: PiutangSidebarFooterProps) {
  const { t } = useAppTranslation();
  const filtered = filteredRows.length;

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('incomes.piutang.footer.activityCount', 'Activities: {{count}}', { count: filtered })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.piutang.footer.total', 'Total: {{count}}', { count: totalActivities })}
        </span>
      </div>
    </div>
  );
}
