import { MobileIncomesShell } from '@/mobile/3-dashboard/pages/MobileIncomesShell';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IncomePiutangPage } from '@/4-1-transaction/piutang';

export default function MobileIncomePiutangPage() {
  const { t } = useAppTranslation();
  return (
    <MobileIncomesShell
      title={t('incomes.pageTitle', 'Incomes')}
      subtitle={t('incomes.piutangTitle', 'Piutang')}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <IncomePiutangPage />
      </div>
    </MobileIncomesShell>
  );
}
