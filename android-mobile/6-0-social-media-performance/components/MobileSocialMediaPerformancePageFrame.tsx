import type { ReactNode } from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import { cn } from "@/shared/lib/utils";
import { SocialMediaPerformanceMobileShellHeader } from "@/mobile/6-0-social-media-performance/components/SocialMediaPerformanceMobileShellHeader";
import { SocialMediaPerformanceMobileFooter } from "@/mobile/6-0-social-media-performance/components/SocialMediaPerformanceMobileFooter";

type MobileSocialMediaPerformancePageFrameProps = {
  children: ReactNode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  isRefreshing?: boolean;
  headerActions?: ReactNode;
};

export function MobileSocialMediaPerformancePageFrame({
  children,
  onRefresh,
  refreshDisabled,
  isRefreshing,
  headerActions,
}: MobileSocialMediaPerformancePageFrameProps) {
  useStatusBarStyle("light");
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingSocialMediaPerformance;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  if (showDenyShellHeader) {
    return (
      <SidebarProvider>
        <div className={cn(outerShellClassName, "bg-muted/70")}>
          <AppSidebar />
          <main
            className={cn(
              "z-0 flex w-full min-w-0 max-w-none flex-col bg-muted/70",
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            <SocialMediaPerformanceMobileShellHeader />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-default"
            />
            {!isKeyboardShellOpen ? (
              <SocialMediaPerformanceMobileFooter className="safe-area-bottom-lower" />
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex min-h-0 flex-col bg-muted/70" style={mainFixedStyle}>
          <SocialMediaPerformanceMobileShellHeader
            onRefresh={hasPageAccess ? onRefresh : undefined}
            refreshDisabled={refreshDisabled}
            isRefreshing={isRefreshing}
            headerActions={hasPageAccess ? headerActions : undefined}
          />
          <ModuleShellContentGate pagePath={pagePath} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-2 px-2 pt-2 pb-1">
                {children}
              </div>
            </div>
          </ModuleShellContentGate>
          {!isKeyboardShellOpen ? (
            <SocialMediaPerformanceMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>
    </SidebarProvider>
  );
}
