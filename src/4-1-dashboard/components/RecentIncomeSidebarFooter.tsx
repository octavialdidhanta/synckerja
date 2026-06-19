import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type RecentIncomeSidebarFooterProps = {
  recentCount: number;
  totalTransactions: number;
};

export function RecentIncomeSidebarFooter({
  recentCount,
  totalTransactions,
}: RecentIncomeSidebarFooterProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('incomes.dashboard.recentFooter.recentCount', 'Recent: {{count}}', {
            count: recentCount,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.dashboard.recentFooter.total', 'Total: {{count}}', {
            count: totalTransactions,
          })}
        </span>
      </div>
    </div>
  );
}
