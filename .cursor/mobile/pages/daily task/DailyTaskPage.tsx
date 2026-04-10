import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile/components/DesktopWarning';
import { SidebarProvider } from '@/mobile/components/ui/sidebar';
import { AppSidebar } from '@/mobile/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile/components/ToolsNavigationFooter';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import { DailyTaskProvider } from '@/features/8-2-DailyTask/DailyTaskContext';
import { ApplyPendingApprovalFocusFromState } from '@/features/8-2-DailyTask/ApplyPendingApprovalFocusFromState';
import { MeetingNotesProvider } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { DailyTaskLayout } from './section/DailyTaskLayout';
import { DailyTaskSummaryView } from './section/DailyTaskSummaryView';
import { JobDescPage } from '@/mobile/pages/job-desc/JobDescPage';

const DailyTaskPage = () => {
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <DailyTaskProvider>
            <ApplyPendingApprovalFocusFromState />
            <div className="min-h-screen flex w-full bg-background">
              <AppSidebar />

              {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc */}
              <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
                {view === 'jobdesc' ? <JobDescPage /> : view === 'summary' ? <DailyTaskSummaryView /> : <DailyTaskLayout />}
                <ToolsNavigationFooter className="safe-area-bottom-lower" />
              </main>
            </div>
          </DailyTaskProvider>
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default DailyTaskPage;
