import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { PiutangOverviewPanel } from './PiutangOverviewPanel';
import { PiutangSidebarFooter } from './PiutangSidebarFooter';

type Props = {
  filteredRows: SalesActivity[];
  totalActivities: number;
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
};

export function PiutangSidebarColumn({
  filteredRows,
  totalActivities,
  verificationByActivity,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
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

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="p-4">
          <PiutangOverviewPanel
            filteredRows={filteredRows}
            verificationByActivity={verificationByActivity}
          />
        </div>
      </div>

      <PiutangSidebarFooter filteredRows={filteredRows} totalActivities={totalActivities} />
    </div>
  );
}
