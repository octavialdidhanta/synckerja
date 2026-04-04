import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const TAB_SKELETON_WIDTHS = ["w-[118px]", "w-[148px]", "w-[156px]", "w-[164px]", "w-[132px]", "w-[124px]", "w-[108px]"];

/**
 * Mirrors `CRMDashboardPage` + `HeaderAndTab` + `CRMDashboardContent` shell for
 * `/operations/consultant/dashboard` — guard, Suspense, and in-page overlay share this component.
 */
export function ConsultantCrmDashboardPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("operations.consultant.dashboard.loadingAria", "Loading CRM dashboard");
  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              {/* HeaderAndTab */}
              <div className="mb-1 min-w-0 shrink-0">
                <div className="min-w-0 max-w-full px-1 py-3">
                  <div className="mb-3 min-w-0 space-y-1.5">
                    <Skeleton className="h-7 w-16 max-w-[90vw]" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                  <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
                    <nav className="flex min-w-0 flex-nowrap gap-x-6">
                      {TAB_SKELETON_WIDTHS.map((w, i) => (
                        <Skeleton key={i} className={`h-9 ${w} shrink-0 rounded-sm`} />
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                  <div className="box-border min-w-0 w-full max-w-4xl shrink-0 self-start overflow-x-auto rounded-lg border border-surface-border bg-card p-4 shadow-sm">
                    <div className="min-w-0 max-w-full space-y-4">
                      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 flex-col rounded-lg border border-surface-border bg-gradient-to-br from-muted/60 to-muted/30 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
                            </div>
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="mt-2 h-2 w-32" />
                          </div>
                        ))}
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 flex-col rounded-lg border border-surface-border bg-card p-4 shadow-sm"
                          >
                            <Skeleton className="mb-1 h-5 w-40" />
                            <Skeleton className="mb-3 h-3 w-48" />
                            <div className="space-y-3">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-[85%] max-w-full" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="min-w-0 overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm">
                        <div className="border-b border-surface-border p-4 pb-3">
                          <Skeleton className="h-5 w-36" />
                        </div>
                        <div className="min-w-0 p-4 pt-3">
                          <div className="space-y-3">
                            <Skeleton className="h-10 w-full max-w-sm" />
                            <Skeleton className="min-h-[200px] w-full rounded-md bg-muted/40" />
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
        </div>
      </div>
    </div>
  );
}
