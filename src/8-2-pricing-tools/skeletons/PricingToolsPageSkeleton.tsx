import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Mirrors `PricingToolsModuleShell` main scroll container. */
const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Mirrors `PricingToolsPage` inner column scroll (`MAIN_INNER_SCROLL`). */
const MAIN_INNER_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PricingToolsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("pricingTools.page.loadingAria", "Memuat alat harga");

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
        <div className={`${MAIN_SCROLL} min-w-0`}>
          <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
            {/* Match `PricingToolsHeaderAndTab`: px-1 py-3, title block, three tabs */}
            <div className="mb-1 min-w-0 shrink-0">
              <div className="px-1 py-3">
                <div className="mb-3">
                  <Skeleton className="mb-1 h-7 w-56 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
                <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
                  <Skeleton className="h-8 w-36 max-w-[32%]" />
                  <Skeleton className="h-8 w-36 max-w-[32%]" />
                  <Skeleton className="h-8 w-40 max-w-[32%]" />
                </div>
              </div>
            </div>

            {/* Same outer grid as shell: `PricingToolsPage` is single col-span-12 child */}
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                {/* View toolbar — same as live page */}
                <div className="mb-2 flex shrink-0 flex-wrap gap-2 px-1">
                  <Skeleton className="h-8 w-[5.75rem] rounded-md" />
                  <Skeleton className="h-8 w-[5.75rem] rounded-md" />
                  <Skeleton className="h-8 w-[6.5rem] rounded-md" />
                </div>

                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  {/* Main column — card shell matches `PricingToolsPage` */}
                  <div className="col-span-12 flex min-h-0 min-w-0 xl:col-span-9">
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className={`${MAIN_INNER_SCROLL} px-6 py-6`}>
                          <div className="space-y-4">
                            {/* Progress card — `PricingWizard` stepper */}
                            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                              <div className="p-4 pt-4">
                                <div className="flex items-start justify-between gap-0 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex min-w-[3.25rem] flex-1 flex-col items-center px-0.5"
                                    >
                                      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                      <Skeleton className="mt-2 h-3 w-14 max-w-full" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Step panel — `PricingWizard` step 1 card */}
                            <div className="rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                              <div className="flex flex-col space-y-1.5 p-6 pb-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Skeleton className="h-5 w-5 shrink-0 rounded" />
                                    <Skeleton className="h-6 w-52 max-w-full" />
                                  </div>
                                  <Skeleton className="h-8 w-[7.5rem] shrink-0 rounded-md" />
                                </div>
                              </div>
                              <div className="space-y-4 px-6 pb-6 pt-0">
                                <div>
                                  <Skeleton className="mb-1.5 h-4 w-36" />
                                  <Skeleton className="h-10 w-full" />
                                </div>
                                <div>
                                  <Skeleton className="mb-1.5 h-4 w-32" />
                                  <Skeleton className="h-10 w-full" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar — structure mirrors `PricingToolsSidebar` + tutorial `ScrollArea` h-96 */}
                  <div className="col-span-12 flex h-full min-h-0 min-w-0 xl:col-span-3">
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className={`${MAIN_INNER_SCROLL} px-6 py-6`}>
                          <div className="flex min-h-0 w-full min-w-0 flex-col space-y-2">
                            <div className="shrink-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                              <div className="space-y-1.5 p-4 pb-2">
                                <div className="flex items-center gap-2">
                                  <Skeleton className="h-5 w-5 shrink-0" />
                                  <Skeleton className="h-5 w-40" />
                                </div>
                              </div>
                              <div className="px-4 pb-4">
                                <div className="flex flex-col items-center py-8">
                                  <Skeleton className="mb-3 h-12 w-12 rounded-full" />
                                  <Skeleton className="h-4 w-[min(100%,16rem)]" />
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                              <div className="space-y-1.5 p-4 pb-2">
                                <Skeleton className="h-5 w-28" />
                              </div>
                              <div className="space-y-2 px-4 pb-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                  <Skeleton key={i} className="h-9 w-full rounded-md" />
                                ))}
                              </div>
                            </div>

                            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                              <div className="shrink-0 space-y-1.5 p-4 pb-3">
                                <div className="flex items-center gap-2">
                                  <Skeleton className="h-5 w-5 shrink-0" />
                                  <Skeleton className="h-6 w-64 max-w-full" />
                                </div>
                              </div>
                              <div className="min-h-96 space-y-3 border-t border-border p-4">
                                <Skeleton className="h-14 w-full rounded-lg" />
                                <Skeleton className="h-24 w-full rounded-lg" />
                                <Skeleton className="h-32 w-full rounded-lg" />
                                <Skeleton className="h-20 w-full rounded-lg" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
        <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
      </div>
    </div>
  );
}
