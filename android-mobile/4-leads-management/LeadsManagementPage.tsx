import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { NavigationFooter } from '@/mobile-app/components/NavigationFooter';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { LeadsManagementLayout } from './section/LeadsManagementLayout';
import { LeadsReportSummaryView } from './report';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';

export default function LeadsManagementPage() {
  useStatusBarStyle('light');
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const { mainFixedStyle } = useVisualViewport();

  const isReportView = view === 'report';

  return (
    <DesktopWarning>
      <SidebarProvider>
        {/* Shell: mobile-tools-layout-android.mdc §1 (min-h-screen + flex, fixed main) */}
        {/* mobile-tools-layout-android.mdc §1: min-h-screen + flex (bukan relative min-h-[100dvh] tanpa flex) */}
        <div className="flex min-h-screen w-full min-w-0 bg-background">
          <AppSidebar />
          <main
            className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 flex-col bg-background"
            style={mainFixedStyle}
          >
            <ModuleShellContentGate
              pagePath={MOBILE_PAGE_PATH.omnichannelLeads}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              {isReportView ? <LeadsReportSummaryView /> : <LeadsManagementLayout />}
            </ModuleShellContentGate>
            <NavigationFooter hideItems className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
