import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ToolsNavigationFooter } from "@/mobile-app/components/ToolsNavigationFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

/**
 * Satu-satunya skeleton loading mobile untuk `/tools/daily-task?view=jobdesc`.
 * Meniru `JobDescPage` + isi `JobDescTracker` + `ToolsNavigationFooter` (5 kolom, Job Desc aktif).
 */
export function MobileToolsDailyTaskJobDescPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("dailyTask.jobDesc.mobile.loadingAria", "Loading Job Desc");

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
        <div className="flex min-h-0 flex-1 flex-col">
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
            </div>
          </header>

          {/* Mirror JobDescPage inner-scroll shell (no outer scroll). */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-2 pt-2">
              <div className="h-0 shrink-0" aria-hidden />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Card className="flex min-h-0 w-full flex-1 flex-col border-0 shadow-none">
                  <CardHeader className="px-0 pb-2 pt-1">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-40" aria-hidden />
                      <Skeleton className="h-3 w-16" aria-hidden />
                    </div>
                    <Skeleton className="mt-2 h-3 w-56 max-w-full" aria-hidden />
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col space-y-1 p-0">
                    <div className="shrink-0 space-y-1 px-0">
                      <Skeleton className="h-3 w-24" aria-hidden />
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-8 w-20 rounded-md" aria-hidden />
                        <Skeleton className="h-8 w-24 rounded-md" aria-hidden />
                        <Skeleton className="h-8 w-24 rounded-md" aria-hidden />
                        <Skeleton className="h-8 w-20 rounded-md" aria-hidden />
                      </div>
                      <Skeleton className="h-9 w-full max-w-md rounded-md" aria-hidden />
                    </div>
                    <div className="shrink-0 px-0">
                      <div className="grid h-9 w-full grid-cols-2 gap-0 rounded-md border border-border bg-muted/30 p-0.5">
                        <Skeleton className="h-8 rounded-sm" aria-hidden />
                        <Skeleton className="h-8 rounded-sm" aria-hidden />
                      </div>
                    </div>
                    <div className="content-padding-above-nav-job-desc flex min-h-0 w-full min-w-0 flex-1 flex-col space-y-1 px-0 pb-1">
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-24 w-full rounded-lg border border-primary/20 bg-primary/5" aria-hidden />
                        <Skeleton className="h-24 w-full rounded-lg border border-emerald-100 bg-emerald-50/80" aria-hidden />
                      </div>
                      <Skeleton className="h-28 w-full rounded-lg border border-border" aria-hidden />
                      <Skeleton className="h-20 w-full rounded-lg border border-border" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
}
