import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getPiutangRemaining } from '../utils/piutangFilter';
import type { SalesActivity } from '@/shared/hooks/organized/sales';

type PiutangSidebarFooterProps = {
  filteredRows: SalesActivity[];
};

export function PiutangSidebarFooter({ filteredRows }: PiutangSidebarFooterProps) {
  const { t } = useAppTranslation();
  const n = filteredRows.length;
  const totalRemaining = filteredRows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0);

  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('incomes.piutang.footer.activityCount', 'Aktivitas: {{count}}', { count: n })}</span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.piutang.footer.remaining', 'Sisa: {{amount}}', {
            amount: formatToRupiah(totalRemaining),
          })}
        </span>
      </div>
    </div>
  );
}
