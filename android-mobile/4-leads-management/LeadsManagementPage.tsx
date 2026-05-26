import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { ConsultantCrmNavigationFooter } from './components/ConsultantCrmNavigationFooter';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { useMobileToolsShellLayout } from '@/shared/hooks/useMobileToolsShellLayout';
import { LeadsManagementLayout } from './section/LeadsManagementLayout';
import { LeadsReportSummaryView } from './report';
import { LeadsMobileShellHeader } from './components/LeadsMobileShellHeader';
import { ToolsMobileDenyGateArea } from '@/mobile-app/components/ToolsMobileDenyGateArea';
import { useToolsMobilePageAccess } from '@/mobile-app/hooks/useToolsMobilePageAccess';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';
import { cn } from '@/shared/lib/utils';

export default function LeadsManagementPage() {
  useStatusBarStyle('light');
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();

  const isReportView = view === 'report';
  const pagePath = MOBILE_PAGE_PATH.omnichannelLeads;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  const pageContent = isReportView ? <LeadsReportSummaryView /> : <LeadsManagementLayout />;

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className={outerShellClassName}>
          <AppSidebar />
          <main
            className={cn(
              'z-0 flex w-full min-w-0 max-w-none flex-col bg-background',
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            {showDenyShellHeader ? (
              <>
                <LeadsMobileShellHeader isReportView={isReportView} />
                <ToolsMobileDenyGateArea
                  pagePath={pagePath}
                  contentPaddingClass="content-padding-above-nav-leads-management"
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

            <ConsultantCrmNavigationFooter className="safe-area-bottom-lower" />
          </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
