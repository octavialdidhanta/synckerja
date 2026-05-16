import { MobileIncomesShell } from '@/mobile/3-dashboard/pages/MobileIncomesShell';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { MobileIncomePiutangSection } from '@/mobile/3-incomes/section/MobileIncomePiutangSection';

export default function MobileIncomePiutangPage() {
  const { t } = useAppTranslation();

  return (
    <MobileIncomesShell
      title={t('incomes.pageTitle', 'Incomes')}
      subtitle={t('incomes.piutangTitle', 'Piutang')}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileIncomePiutangSection />
      </div>
    </MobileIncomesShell>
  );
}
