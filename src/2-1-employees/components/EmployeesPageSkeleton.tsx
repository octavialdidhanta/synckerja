import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/**
 * Mirrors EmployeePage: outer flex shell, scroll chain, HeaderAndTab, 9+3 grid, filters card, metrics, table card, sidebar.
 */
export function EmployeesPageSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={t("employees.page.loadingAria", "Loading employees")}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-56 max-w-[90%]" />
                      <Skeleton className="h-3 w-full max-w-md" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex space-x-6" aria-hidden>
                        <Skeleton className="h-9 w-52" />
                        <Skeleton className="h-9 w-28" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="mb-2 flex-shrink-0">
                        <div className="rounded-md border border-border bg-card p-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Skeleton className="h-9 min-w-[150px] flex-1 sm:max-w-xs" />
                            <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                            <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                            <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                            <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                          </div>
                        </div>
                      </div>

                      <div className="mb-2 flex-shrink-0">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-brand-blue/30 bg-brand-blue/10 p-4"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-5 w-5 shrink-0 rounded" />
                              </div>
                              <Skeleton className="mb-1 h-8 w-16" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          <div className="flex h-full min-h-0 min-w-0 flex-col">
                            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
                              <div className="min-w-[720px] px-0">
                                <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b border-border bg-gray-50 px-3 shadow-sm">
                                  {Array.from({ length: 10 }).map((_, i) => (
                                    <Skeleton key={i} className="h-3 w-16 shrink-0" />
                                  ))}
                                </div>
                                <div className="divide-y divide-border">
                                  {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="flex h-12 items-center gap-3 px-3">
                                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <Skeleton className="h-3.5 w-40 max-w-[50%]" />
                                        <Skeleton className="h-3 w-52 max-w-[70%]" />
                                      </div>
                                      <Skeleton className="hidden h-3 w-20 shrink-0 sm:block" />
                                      <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <Skeleton className="h-3 w-52 max-w-[55%]" />
                                <Skeleton className="h-3 w-36 max-w-[40%]" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-full max-w-[200px]" />
                            </div>
                            <Skeleton className="h-8 w-[7.5rem] shrink-0 rounded-md" />
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <div className="h-full min-h-0 overflow-hidden p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 gap-3">
                                <Skeleton className="h-[4.25rem] w-full rounded-lg" />
                                <Skeleton className="h-[4.25rem] w-full rounded-lg" />
                                <Skeleton className="h-[4.25rem] w-full rounded-lg" />
                              </div>
                              <Skeleton className="h-24 w-full rounded-lg" />
                              <Skeleton className="h-20 w-full rounded-lg" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-3 w-20" />
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
    </div>
  );
}
