import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SubscriptionExpiryBannerSlot } from '@/10-subscription/shared/SubscriptionExpiryBannerSlot';

type LeadsMobileShellHeaderProps = {
  isReportView: boolean;
};

/**
 * Shown when page access is denied so chrome matches list/report routes (title + sidebar trigger).
 * When access is allowed, {@link LeadsManagementLayout} / {@link LeadsReportSummaryView} render their own headers with actions.
 */
export function LeadsMobileShellHeader({ isReportView }: LeadsMobileShellHeaderProps) {
  const { t } = useAppTranslation();

  return (
    <>
    <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="md:hidden shrink-0" />
        <div className="min-w-0">
          {isReportView ? (
            <>
              <h1 className="truncate text-base font-semibold text-foreground">
                {t('leadsManagement.reportSummary.title', 'Report Summary')}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {t('leadsManagement.reportSummary.subtitle', 'Data summary based on filters')}
              </p>
            </>
          ) : (
            <>
              <h1 className="truncate text-base font-semibold text-foreground">
                {t('leadsManagement.page.title', 'Leads')}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {t('leadsManagement.page.subtitle', 'Manage leads and consultant activities')}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="w-9 shrink-0" aria-hidden />
    </header>
    <SubscriptionExpiryBannerSlot />
    </>
  );
}
