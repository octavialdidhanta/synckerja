import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { PiutangOverviewPanel } from './PiutangOverviewPanel';
import { PiutangSidebarFooter } from './PiutangSidebarFooter';

type Props = {
  filteredRows: SalesActivity[];
};

export function PiutangSidebarColumn({ filteredRows }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
        <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                {t('incomes.piutang.summary.title', 'Ringkasan piutang')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('incomes.piutang.summary.subtitle', 'Ikhtisar berdasarkan filter saat ini')}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 overflow-hidden p-4">
            <PiutangOverviewPanel filteredRows={filteredRows} />
          </div>
        </div>

        <PiutangSidebarFooter filteredRows={filteredRows} />
      </div>
    </div>
  );
}
