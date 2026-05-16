import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile-app/components/ToolsNavigationFooter';
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

function DailyTaskPageBody() {
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const { showPageSkeleton } = useMobileDailyTaskPageSkeletonGate(view);

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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {view === 'jobdesc' ? (
            <JobDescPage />
          ) : view === 'summary' ? (
            <DailyTaskSummaryView />
          ) : view === 'initiative' ? (
            <InitiativeMobileTab />
          ) : (
            <DailyTaskLayout />
          )}
        </div>
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
