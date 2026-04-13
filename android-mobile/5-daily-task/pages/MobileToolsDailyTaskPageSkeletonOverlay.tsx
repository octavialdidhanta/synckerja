import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { ToolsNavigationFooter } from "@/mobile-app/components/ToolsNavigationFooter";
import { DailyTaskPageSkeleton } from "@/mobile/5-daily-task/DailyTaskPageSkeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

const SCROLL_CHAIN =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Mobile fullscreen skeleton for `/tools/daily-task` default view.
 * Mirrors `DailyTaskLayout` shell and uses real `ToolsNavigationFooter`.
 */
export function MobileToolsDailyTaskPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("dailyTask.page.loadingAria", "Loading daily task");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen w-full min-w-0 flex-col bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 flex-col bg-background"
        style={mainFixedStyle}
      >
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="min-w-0 space-y-1">
              <Skeleton className="h-4 max-w-[140px]" aria-hidden />
              <Skeleton className="h-3 max-w-[220px]" aria-hidden />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton className="h-9 w-9 rounded-lg" aria-hidden />
            <Skeleton className="h-9 w-9 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 rounded-md" aria-hidden />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="h-0 shrink-0" aria-hidden />
            <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-daily-task">
              <DailyTaskPageSkeleton />
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
}
