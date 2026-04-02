import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

/** Mirror `IncomeTransactionPage` — varian header ikut scroll + AppShell (`h-full`, bukan `h-screen`). */
const INCOME_TX_MAIN_GRID =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function IncomeTransactionSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("incomes.transaction.loadingAria", "Loading income transactions");
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
                <div className="mb-3 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-44" />
                </div>
              </div>

              <div className={INCOME_TX_MAIN_GRID}>
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
                  <div className="mb-2 shrink-0">
                    <div className="rounded-md border border-border bg-card p-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Skeleton className="h-9 min-w-[150px] flex-1" />
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-20" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 shrink-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-md border border-border bg-card p-2.5 shadow-sm">
                          <Skeleton className="mb-1 h-3 w-20" />
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="mt-1 h-2 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                      <div className="min-w-0 overflow-x-auto p-2">
                        <div className="min-w-[640px] space-y-2">
                          <Skeleton className="h-8 w-full" />
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-border px-4 py-2">
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 flex min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
                  <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                    <div className="shrink-0 border-b border-border px-4 py-1.5">
                      <Skeleton className="mb-1 h-4 w-36" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden p-4">
                      <Skeleton className="mb-4 h-9 w-full max-w-[240px]" />
                      <div className="space-y-3">
                        <Skeleton className="h-20 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                      </div>
                    </div>
                    <div className="border-t border-border bg-muted/50 px-4 py-2">
                      <Skeleton className="h-4 w-full max-w-[200px]" />
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
