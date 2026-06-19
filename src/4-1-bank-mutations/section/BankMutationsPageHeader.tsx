import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export function BankMutationsPageHeader() {
  const { t } = useAppTranslation();

  return (
    <div className="px-1 py-3">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground">
        {t('finance.bankMutations.pageTitle', 'Riwayat Rekening')}
      </h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {t(
          'finance.bankMutations.pageSubtitle',
          'Pantau uang masuk dan keluar di rekening bank, lalu cocokkan dengan pendapatan atau pengeluaran.',
        )}
      </p>
    </div>
  );
}
