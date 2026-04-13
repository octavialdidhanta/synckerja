import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { ToolsNavigationFooter } from "@/mobile-app/components/ToolsNavigationFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

const SCROLL_CHAIN =
  "scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Mobile fullscreen skeleton for `/tools/daily-task?view=initiative`.
 * Mirrors `InitiativeMobileTab` shell: sticky header, single scroll area, and tools footer.
 */
export function MobileToolsDailyTaskInitiativePageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("initiative.page.loadingAria", "Loading initiative");

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
          <div className="shrink-0" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="content-padding-above-nav-daily-task mx-auto w-full max-w-md space-y-1 px-2 pt-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" aria-hidden />
                  <Skeleton className="h-4 w-32" aria-hidden />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" aria-hidden />
                    <Skeleton className="h-4 w-8" aria-hidden />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" aria-hidden />
                    <Skeleton className="h-4 w-8" aria-hidden />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded" aria-hidden />
                      <Skeleton className="h-5 w-14 rounded" aria-hidden />
                    </div>
                    <Skeleton className="mb-2 h-4 w-full" aria-hidden />
                    <Skeleton className="mb-1 h-4 w-4/5" aria-hidden />
                    <Skeleton className="h-3 w-24" aria-hidden />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
}
