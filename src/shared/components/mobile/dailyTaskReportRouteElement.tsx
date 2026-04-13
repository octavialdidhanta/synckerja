import { lazy, Suspense, type ReactNode } from "react";
import { DailyTaskReportRouteLoadingShell } from "@/shared/components/mobile/DailyTaskReportRouteLoadingShell";
import MobileDailyTaskReportPage from "@/mobile/5-daily-task-report/DailyTaskReportPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopDailyTaskReportPage = lazy(() => import("@/8-2-DailyTaskReport/pages/DailyTaskReportPage"));

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <DailyTaskReportRouteLoadingShell />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/tools/daily-task-report`: viewport tools-mobile atau native → `android-mobile/5-daily-task-report/DailyTaskReportPage`.
 * Harus dipasangkan dengan `AdaptiveAppLayout` bypass `AppShellLayout` untuk path ini.
 */
export function DailyTaskReportRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopDailyTaskReportPage />
      </ShellSuspense>
    );
  }
  return <MobileDailyTaskReportPage />;
}
