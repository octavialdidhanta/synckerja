import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile-app/components/ToolsNavigationFooter';
import { ToolsMobileShellHeader, type ToolsMobileShellHeaderVariant } from '@/mobile-app/components/ToolsMobileShellHeader';
import { ToolsMobileDenyGateArea } from '@/mobile-app/components/ToolsMobileDenyGateArea';
import { useToolsMobilePageAccess } from '@/mobile-app/hooks/useToolsMobilePageAccess';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { DailyTaskProvider } from '@/8-2-DailyTask/context/DailyTaskContext';
import { ApplyPendingApprovalFocusFromState } from '@/8-2-DailyTask/components/ApplyPendingApprovalFocusFromState';
import { MeetingNotesProvider } from '@/8-1-meeting-notes/context/MeetingNotesContext';
import { DailyTaskLayout } from './section/DailyTaskLayout';
import { DailyTaskSummaryView } from './section/DailyTaskSummaryView';
import { JobDescPage } from '@/mobile/5-job-desc';
import { InitiativeMobileTab } from '@/mobile/5-initiative/InitiativePage';
import { MobileToolsDailyTaskPageSkeletonOverlay } from '@/mobile/5-daily-task/pages/MobileToolsDailyTaskPageSkeletonOverlay';
import { useMobileDailyTaskPageSkeletonGate } from '@/mobile/5-daily-task/hooks/useMobileDailyTaskPageSkeletonGate';
import { cn } from '@/shared/lib/utils';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';

function dailyTaskHeaderVariant(view: string | null): ToolsMobileShellHeaderVariant {
  if (view === 'initiative') return 'initiative';
  if (view === 'jobdesc') return 'jobdesc';
  if (view === 'summary') return 'summary';
  return 'dailyTask';
}

function DailyTaskPageBody() {
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const pagePath = MOBILE_PAGE_PATH.toolsDailyTask;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);
  const headerVariant = dailyTaskHeaderVariant(view);

  const { showPageSkeleton: dataPendingSkeleton } = useMobileDailyTaskPageSkeletonGate(view);
  const { showFullPageSkeleton: showPageSkeleton } = useModulePageOverlaySkeleton(
    dataPendingSkeleton,
    pagePath,
  );

  const pageContent =
    view === 'jobdesc' ? (
      <JobDescPage />
    ) : view === 'summary' ? (
      <DailyTaskSummaryView />
    ) : view === 'initiative' ? (
      <InitiativeMobileTab />
    ) : (
      <DailyTaskLayout />
    );

  return (
    <div className="flex min-h-screen min-w-0 w-full bg-background">
      <AppSidebar />

      <main
        className={cn(
          'fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 max-w-none flex-col bg-background',
          showPageSkeleton && 'pointer-events-none invisible select-none',
        )}
        style={mainFixedStyle}
        aria-hidden={showPageSkeleton}
      >
        {showDenyShellHeader ? (
          <>
            <ToolsMobileShellHeader variant={headerVariant} />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-daily-task"
            />
          </>
        ) : (
          <ModuleShellContentGate
            pagePath={pagePath}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? pageContent : null}
          </ModuleShellContentGate>
        )}

        {!isKeyboardShellOpen ? (
          <ToolsNavigationFooter className="safe-area-bottom-lower" />
        ) : null}
      </main>

      {showPageSkeleton ? <MobileToolsDailyTaskPageSkeletonOverlay /> : null}
    </div>
  );
}

const DailyTaskPage = () => {
  useStatusBarStyle('light');

  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <DailyTaskProvider>
            <ApplyPendingApprovalFocusFromState />
            <DailyTaskPageBody />
          </DailyTaskProvider>
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default DailyTaskPage;
