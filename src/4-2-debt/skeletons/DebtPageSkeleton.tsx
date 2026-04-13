import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

/** Mirror `DebtPage` + Seamless Page Scroll Layout (header ikut scroll, AppShell: `h-full` bukan `h-screen`). */
const DEBT_MAIN_GRID =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Skeleton khusus `/expenses/debt` — selaras `DebtPage` + Seamless Page Scroll Layout.
 */
export function DebtPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("debt.page.loadingAria", "Loading debt");
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, "min-w-0")}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 shrink-0 px-1 py-3">
                <div className="mb-3 min-w-0 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={cn("h-9 shrink-0", i === 0 ? "w-36 sm:w-40" : "w-24 sm:w-28")} />
                  ))}
                </div>
              </div>

              <div className={DEBT_MAIN_GRID}>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-28 w-full shrink-0 rounded-lg bg-brand-blue/25 md:h-32" />

                  <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm"
                      >
                        <Skeleton className="mb-2 h-3 w-24" />
                        <Skeleton className="h-8 w-28" />
                        <Skeleton className="mt-2 h-2 w-16" />
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                    <div className="flex-shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <Skeleton className="h-9 w-full min-w-[12rem] sm:w-56" />
                          <Skeleton className="h-9 w-40" />
                          <Skeleton className="h-9 w-36" />
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Skeleton className="h-9 w-28 sm:w-32" />
                          <Skeleton className="h-9 w-28 sm:w-32" />
                        </div>
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col space-y-2 p-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full shrink-0 rounded-md" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
            <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
