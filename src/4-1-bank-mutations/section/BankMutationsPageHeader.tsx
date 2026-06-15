import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export function BankMutationsPageHeader() {
  const { t } = useAppTranslation();

  return (
    <div className="px-1 py-3">
      <h1 className="mb-0.5 text-xl font-bold text-foreground">
        {t('finance.bankMutations.pageTitle', 'Mutasi Rekening')}
      </h1>
      <p className="text-xs text-muted-foreground">
        {t(
          'finance.bankMutations.pageSubtitle',
          'Mutasi masuk dan keluar dari Brick serta Payment Process — cocokkan dengan income dan expense.',
        )}
      </p>
    </div>
  );
}
