import { Skeleton } from "@/shared/components/ui/skeleton";
import { ToolsNavigationFooter } from "@/mobile-app/components/ToolsNavigationFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

const SCROLL_CHAIN =
  "scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Skeleton overlay mobile untuk `/tools/daily-task-report`.
 * Meniru `DailyTaskReportPage` (header + scroll + kartu ringkas) + `ToolsNavigationFooter` (tab Report aktif).
 */
export function MobileToolsDailyTaskReportPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("dailyTaskReport.page.loadingAria", "Loading daily task report");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen min-w-0 w-full flex-col bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main className="fixed inset-x-0 z-0 flex flex-col bg-background" style={mainFixedStyle}>
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 max-w-[220px]" aria-hidden />
              <Skeleton className="h-3 max-w-[min(100%,280px)]" aria-hidden />
            </div>
          </div>
          <div />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="content-padding-above-nav-daily-task-report mx-auto flex min-w-0 w-full max-w-md flex-1 flex-col space-y-1 px-2 pt-2">
                <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 min-w-[120px] flex-1 rounded-md" aria-hidden />
                    <Skeleton className="h-9 w-28 rounded-md" aria-hidden />
                    <Skeleton className="h-9 w-28 rounded-md" aria-hidden />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-lg" aria-hidden />
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-28" aria-hidden />
                    <Skeleton className="h-8 w-20 rounded-md" aria-hidden />
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex justify-between gap-2">
                        <Skeleton className="h-4 w-24" aria-hidden />
                        <Skeleton className="h-5 w-16 rounded" aria-hidden />
                      </div>
                      <Skeleton className="h-3 w-full" aria-hidden />
                      <Skeleton className="h-3 w-32" aria-hidden />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex gap-2 border-b border-border p-2">
                    <Skeleton className="h-9 w-24 rounded" aria-hidden />
                    <Skeleton className="h-9 w-24 rounded" aria-hidden />
                  </div>
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 rounded-md" aria-hidden />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
}
