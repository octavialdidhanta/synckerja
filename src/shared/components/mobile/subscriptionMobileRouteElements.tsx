import { lazy, Suspense, type ReactNode } from "react";
import { SubscriptionShellSkeleton } from "@/10-subscription/shared/SubscriptionShellSkeleton";
import MobileSubscriptionOverviewPage from "@/mobile/6-subscription/OverviewTabPage";
import MobileSubscriptionPlansPage from "@/mobile/6-subscription/PlansTabPage";
import MobileSubscriptionManagementPage from "@/mobile/6-subscription/ManagementTabPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopSubscriptionOverviewPage = lazy(() => import("@/10-subscription/overview/OverviewPage"));
const DesktopSubscriptionPlansPage = lazy(() => import("@/10-subscription/plans/PlansPage"));
const DesktopSubscriptionManagementPage = lazy(() => import("@/10-subscription/management/ManagementPage"));

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100" aria-busy>
          <SubscriptionShellSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/subscription/overview`: viewport tools-mobile atau native → `android-mobile/6-subscription/OverviewTabPage`.
 * Pasangkan dengan `AdaptiveAppLayout` bypass untuk path subscription mobile.
 */
export function SubscriptionOverviewRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopSubscriptionOverviewPage />
      </ShellSuspense>
    );
  }
  return <MobileSubscriptionOverviewPage />;
}

/** `/subscription/plans` → `android-mobile/6-subscription/PlansTabPage`. */
export function SubscriptionPlansRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopSubscriptionPlansPage />
      </ShellSuspense>
    );
  }
  return <MobileSubscriptionPlansPage />;
}

/** `/subscription/management` → `android-mobile/6-subscription/ManagementTabPage`. */
export function SubscriptionManagementRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopSubscriptionManagementPage />
      </ShellSuspense>
    );
  }
  return <MobileSubscriptionManagementPage />;
}
