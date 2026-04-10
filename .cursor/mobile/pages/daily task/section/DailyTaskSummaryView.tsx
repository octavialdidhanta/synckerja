import React from 'react';
import { SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import TaskSummaryCards from '@/features/8-2-DailyTask/section/TaskSummaryCards';

/**
 * Mobile full-screen Task Summary view (view=summary).
 * Header + scroll area with TaskSummaryCards (including Pending Approval).
 * Layout per .cursor/rules/mobile-tools-layout-android.mdc.
 */
export function DailyTaskSummaryView() {
  const { t } = useAppTranslation();

  return (
    <>
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t('dailyTask.page.title', 'Daily Task')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('dailyTask.summary.subtitle', 'Task Summary')}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col">
          <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-daily-task space-y-1">
            <TaskSummaryCards />
          </div>
        </div>
      </div>
    </>
  );
}
