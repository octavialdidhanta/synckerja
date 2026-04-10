import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile/components/DesktopWarning';
import { SidebarProvider } from '@/mobile/components/ui/sidebar';
import { AppSidebar } from '@/mobile/components/AppSidebar';
import { NavigationFooter } from '@/mobile/components/NavigationFooter';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import { LeadsManagementLayout } from './section/LeadsManagementLayout';
import { LeadsReportSummaryView } from './report';

export default function LeadsManagementPage() {
  useStatusBarStyle('light');
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const { mainFixedStyle } = useVisualViewport();

  const isReportView = view === 'report';

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
            <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
            {isReportView ? <LeadsReportSummaryView /> : <LeadsManagementLayout />}
            <NavigationFooter hideItems className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
