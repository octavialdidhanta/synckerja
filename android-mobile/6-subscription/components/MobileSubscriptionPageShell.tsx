import type { CSSProperties, ReactNode } from "react";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import {
  SubscriptionBottomTabs,
  type SubscriptionTabKey,
} from "@/mobile/6-subscription/shared/SubscriptionTabs";
import {
  SubscriptionMobileShellHeader,
  type SubscriptionMobileShellHeaderVariant,
} from "@/mobile/6-subscription/components/SubscriptionMobileShellHeader";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { cn } from "@/shared/lib/utils";

type MobileSubscriptionPageShellProps = {
  pagePath: string;
  headerVariant: SubscriptionMobileShellHeaderVariant;
  activeTab: SubscriptionTabKey;
  onTabChange: (tab: SubscriptionTabKey) => void;
  outerShellClassName?: string;
  mainFixedStyle?: CSSProperties;
  mainClassName?: string;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  showPageSkeleton?: boolean;
  skeletonOverlay?: ReactNode;
  /** Scroll + content inside gate when access is allowed. */
  children: ReactNode;
};

export function MobileSubscriptionPageShell({
  pagePath,
  headerVariant,
  activeTab,
  onTabChange,
  outerShellClassName,
  mainFixedStyle,
  mainClassName,
  headerClassName,
  headerStyle,
  showPageSkeleton,
  skeletonOverlay,
  children,
}: MobileSubscriptionPageShellProps) {
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);
  const layout = useMobileToolsShellLayout();
  const resolvedOuterShell = outerShellClassName ?? layout.outerShellClassName;
  const resolvedMainStyle = layout.isAndroidNative
    ? layout.mainShellStyle
    : (mainFixedStyle ?? layout.mainShellStyle);
  const resolvedMainClassName = cn(
    layout.mainShellClassName,
    !layout.isAndroidNative && "fixed inset-x-0 min-h-0",
    showPageSkeleton && "pointer-events-none invisible select-none",
    mainClassName,
  );
  const resolvedHeaderClassName = headerClassName ?? layout.mobileHeaderChrome.className;
  const resolvedHeaderStyle = headerStyle ?? layout.mobileHeaderChrome.style;

  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className={resolvedOuterShell}>
          <AppSidebar />

          <main
            className={cn("z-0 flex w-full min-w-0 max-w-none flex-col bg-background", resolvedMainClassName)}
            style={resolvedMainStyle}
            aria-hidden={showPageSkeleton}
          >
            <SubscriptionMobileShellHeader
              variant={headerVariant}
              className={resolvedHeaderClassName}
              style={resolvedHeaderStyle}
            />

            {showDenyShellHeader ? (
              <ToolsMobileDenyGateArea
                pagePath={pagePath}
                contentPaddingClass="content-padding-above-nav-default"
              />
            ) : (
              <ModuleShellContentGate
                pagePath={pagePath}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                {hasPageAccess ? children : null}
              </ModuleShellContentGate>
            )}

            <SubscriptionBottomTabs
              activeTab={activeTab}
              onTabChange={onTabChange}
              className="safe-area-bottom-lower"
            />
          </main>

          {skeletonOverlay}
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
}
