import { lazy, Suspense, type ReactNode } from "react";
import { DailyTaskPageSkeleton } from "@/8-2-DailyTask/skeletons/DailyTaskPageSkeleton";
import { DailyTaskRouteLoadingShell } from "@/shared/components/mobile/DailyTaskRouteLoadingShell";
import MobileDailyTaskPage from "@/mobile/5-daily-task/DailyTaskPage";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

const DesktopDailyTaskPage = lazy(() => import("@/8-2-DailyTask/pages/DailyTaskPage"));

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <DailyTaskPageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * `/tools/daily-task`: viewport tools-mobile atau native → `android-mobile/5-daily-task/DailyTaskPage`.
 * Harus dipasangkan dengan `AdaptiveAppLayout` yang melewati `AppShellLayout` untuk path ini agar tidak dobel `AppHeader`.
 */
export function DailyTaskRouteElement() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <DesktopDailyTaskPage />
      </ShellSuspense>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen min-w-0 w-full flex-col bg-background" aria-busy>
          <DailyTaskRouteLoadingShell />
        </div>
      }
    >
      <MobileDailyTaskPage />
    </Suspense>
  );
}
