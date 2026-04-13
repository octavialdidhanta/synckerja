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

const DailyTaskPage = () => {
  useStatusBarStyle('light');
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const [searchParams] = useSearchParams();
  /** `jobdesc` → `android-mobile/5-job-desc/JobDescPage` (tools footer “Job Desc”). */
  const view = searchParams.get('view');

  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <DailyTaskProvider>
            <ApplyPendingApprovalFocusFromState />
            {/* Shell: mobile-tools-layout-android.mdc §1 — min-h-screen + flex (bukan min-h-[100dvh] saja). */}
            <div className="flex min-h-screen min-w-0 w-full bg-background">
              <AppSidebar />

              {/* Selaras DailyTaskReport + §3: body flex-1, footer anak langsung main; footer disembunyikan saat keyboard (§1). */}
              <main
                className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 max-w-none flex-col bg-background"
                style={mainFixedStyle}
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
            </div>
          </DailyTaskProvider>
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default DailyTaskPage;
