import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

/** Mirror `PaymentProcessPage` + Seamless Page Scroll Layout (header ikut scroll, AppShell: `h-full` bukan `h-screen`). */
const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const GRID_MAIN =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px] xl:grid-rows-1 xl:items-stretch";

const TABLE_SECTION =
  "flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]";

/**
 * Skeleton khusus `/expenses/payment-process` — selaras `PaymentProcessPage` + pola approvals / debt.
 */
export function PaymentProcessPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("expenses.paymentProcess.loadingAria", "Loading payment process");
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-brand-white font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, "min-w-0")}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 flex-shrink-0 px-1 py-3">
                <div className="mb-3 min-w-0 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className={cn("h-9 shrink-0", i === 0 ? "w-36 sm:w-40" : "w-24 sm:w-28")}
                    />
                  ))}
                </div>
              </div>

              <div className={GRID_MAIN}>
                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
                  <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
                    <div className="shrink-0 rounded-md border border-border bg-card p-2">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Skeleton className="h-9 min-w-[150px] flex-1 sm:max-w-xs" />
                        <Skeleton className="h-9 w-36 sm:w-40" />
                        <Skeleton className="h-9 w-36 sm:w-40" />
                        <Skeleton className="h-9 w-36 sm:w-40" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-border bg-card p-3 shadow-sm"
                        >
                          <Skeleton className="mb-2 h-3 w-24" />
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="mt-2 h-3 w-28" />
                        </div>
                      ))}
                    </div>

                    <div className={TABLE_SECTION}>
                      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
                        <Skeleton className="h-4 w-44" />
                      </div>
                      <div className="min-w-0 space-y-2 p-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="h-11 w-full rounded-md" />
                        ))}
                      </div>
                      <div className="flex shrink-0 justify-between border-t border-border bg-card px-4 py-2">
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
                  <div className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                    <div className="shrink-0 border-b border-border px-4 py-1.5">
                      <Skeleton className="mb-1 h-4 w-36" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 space-y-2 p-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-md" />
                      ))}
                    </div>
                    <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                      <Skeleton className="h-3 w-full max-w-[200px]" />
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
