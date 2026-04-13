import { lazy, Suspense, type ReactNode } from "react";
import { LeadsManagementPageSkeleton } from "@/5-1-leads-management/skeletons/LeadsManagementPageSkeleton";
import MobileConsultantLeadsManagementPage from "@/mobile/4-leads-management/LeadsManagementPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopConsultantLeadsManagementPage = lazy(() =>
  import("@/5-1-leads-management/pages/ConsultantDashboardPage").then((m) => ({
    default: m.ConsultantDashboardPage,
  })),
);

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
          aria-busy
        >
          <LeadsManagementPageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/operations/consultant/leads-management`: viewport tools-mobile atau native → `android-mobile/4-leads-management/LeadsManagementPage`.
 * Harus dipasangkan dengan `AdaptiveAppLayout` bypass `AppShellLayout` untuk path ini.
 */
export function ConsultantLeadsManagementRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopConsultantLeadsManagementPage />
      </ShellSuspense>
    );
  }
  return <MobileConsultantLeadsManagementPage />;
}
