import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';
import { SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

/**
 * Loading skeleton for Leads Report Summary view.
 * Matches the section layout of LeadsInsights (Overview: Conversion, Date, Source, Data Summary, Status, etc.)
 */
export function LeadsReportSummarySkeleton() {
  const { t } = useAppTranslation();

  const cardSections = [
    { titleWidth: 'w-36', lines: 3 },
    { titleWidth: 'w-20', lines: 1 },
    { titleWidth: 'w-28', lines: 2 },
    { titleWidth: 'w-24', lines: 3 },
    { titleWidth: 'w-32', lines: 2 },
    { titleWidth: 'w-28', lines: 4 },
    { titleWidth: 'w-24', lines: 2 },
    { titleWidth: 'w-36', lines: 3 },
  ];

  return (
    <>
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {t('leadsManagement.reportSummary.title', 'Report Summary')}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {t('leadsManagement.reportSummary.subtitle', 'Data summary based on filters')}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col overscroll-contain seamless-scroll">
          <div className="mx-auto w-full max-w-md px-2 pt-1 content-padding-above-nav-leads-management space-y-1 min-w-0 flex-1">
            {cardSections.map((section, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <Skeleton className={`h-4 ${section.titleWidth}`} />
                <div className="space-y-1.5">
                  {Array.from({ length: section.lines }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
