import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { getPiutangRemaining } from '@/4-1-transaction/piutang/utils/piutangFilter';

export type MobilePiutangTableFooterProps = {
  totalActivities: number;
  filteredRows: SalesActivity[];
};

/** Footer kartu daftar piutang mobile — selaras `MobileIncomeTransactionTableFooter`. */
export function MobilePiutangTableFooter({ totalActivities, filteredRows }: MobilePiutangTableFooterProps) {
  const { t } = useAppTranslation();
  const filtered = filteredRows.length;
  const totalRemaining = filteredRows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t('incomes.piutang.footer.showing', 'Menampilkan')} {filtered}{' '}
          {t('incomes.piutang.footer.of', 'dari')} {totalActivities}{' '}
          {t('incomes.piutang.footer.activities', 'aktivitas')}
        </span>
        <span className="shrink-0 text-right">
          {t('incomes.piutang.footer.totalRemaining', 'Total sisa')}:{' '}
          <span className="font-bold text-red-600">{formatToRupiah(totalRemaining)}</span>
        </span>
      </div>
    </div>
  );
}
