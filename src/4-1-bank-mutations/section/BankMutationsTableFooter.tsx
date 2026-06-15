import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  filteredCount: number;
  suggestedCount: number;
};

export function BankMutationsTableFooter({ filteredCount, suggestedCount }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('finance.bankMutations.footerShowing', 'Menampilkan {{count}} mutasi', {
            count: filteredCount,
          })}
          {suggestedCount > 0
            ? ` · ${t('finance.bankMutations.footerSuggested', '{{count}} saran match', { count: suggestedCount })}`
            : ''}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('finance.bankMutations.footerTotal', 'Total: {{count}}', { count: filteredCount })}
        </span>
      </div>
    </div>
  );
}
