import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

function useRecruitmentLoadingAria() {
  const { t } = useAppTranslation();
  return t("recruitment.page.loadingAria", "Loading recruitment");
}

/** Lazy-route / Suspense fallback: generic header strip + main card (matches shell content area). */
export function RecruitmentRouteSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 flex-shrink-0 px-1 py-3">
          <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
          <Skeleton className="mb-4 h-3 w-full max-w-xl" />
          <div className="flex flex-wrap gap-4 border-b border-border pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
        <Skeleton className="min-h-[min(70vh,520px)] w-full flex-1 rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}

export function RecruitmentDashboardSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-44 max-w-[90%]" />
                      <Skeleton className="h-3 w-full max-w-xl" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-36" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <div className="flex min-h-full min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <div className="min-w-0 flex-1 space-y-6 p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                          <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-4">
                            <Skeleton className="mb-2 h-8 w-12 bg-background/40" />
                            <Skeleton className="h-4 w-36 bg-background/40" />
                          </div>
                          <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
                            <Skeleton className="mb-2 h-8 w-12 bg-yellow-100/90" />
                            <Skeleton className="h-4 w-32 bg-yellow-100/90" />
                          </div>
                          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                            <Skeleton className="mb-2 h-8 w-12 bg-green-100/90" />
                            <Skeleton className="h-4 w-40 bg-green-100/90" />
                          </div>
                          <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
                            <Skeleton className="mb-2 h-8 w-12 bg-purple-100/90" />
                            <Skeleton className="h-4 w-28 bg-purple-100/90" />
                          </div>
                        </div>
                        <div className="rounded-lg border bg-white p-4">
                          <Skeleton className="mb-4 h-5 w-52 max-w-[80%]" />
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-3 rounded bg-gray-50 p-3"
                              >
                                <div className="min-w-0 flex-1 space-y-2">
                                  <Skeleton className="h-4 w-48 max-w-[75%]" />
                                  <Skeleton className="h-3 w-56 max-w-[90%]" />
                                </div>
                                <div className="shrink-0 space-y-2">
                                  <Skeleton className="ml-auto h-4 w-20" />
                                  <Skeleton className="ml-auto h-3 w-28" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-44 max-w-[60%]" />
                          <Skeleton className="h-3 w-24 max-w-[35%]" />
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
    </div>
  );
}

/** Mirrors JobOpeningsPage: HeaderAndTab, 9+3 grid, filters, metrics, table card, overview sidebar. */
export function JobOpeningsPageSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-0.5 h-7 w-44 max-w-[90%]" />
                    <Skeleton className="h-3 w-full max-w-xl" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
                      <Skeleton className="h-9 w-28" />
                      <Skeleton className="h-9 w-32" />
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-9 flex min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-2 flex-shrink-0">
                      <div className="rounded-md border bg-white p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Skeleton className="h-9 min-w-[150px] flex-1 sm:max-w-xs" />
                          <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                          <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                          <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                          <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                          <Skeleton className="h-9 w-full sm:w-36 lg:w-40" />
                        </div>
                      </div>
                    </div>

                    <div className="mb-2 flex-shrink-0">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          "border-blue-200",
                          "border-green-200",
                          "border-yellow-200",
                          "border-purple-200",
                        ].map((borderClass, i) => (
                          <div key={i} className={`rounded-md border bg-white p-3 shadow-sm ${borderClass}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-6 w-12" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                              <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1">
                      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                        <div className="min-h-0 flex-1 overflow-x-auto">
                          <div className="min-w-[900px]">
                            <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 shadow-sm">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-3 w-14 shrink-0" />
                              ))}
                            </div>
                            <div className="divide-y divide-gray-100">
                              {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="flex h-11 items-center gap-2 px-3">
                                  <Skeleton className="h-3.5 w-40 flex-1" />
                                  <Skeleton className="h-3 w-20 shrink-0" />
                                  <Skeleton className="h-3 w-20 shrink-0" />
                                  <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
                                  <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex-shrink-0 border-b px-4 py-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Skeleton className="h-4 w-44" />
                            <Skeleton className="h-3 w-full max-w-[200px]" />
                          </div>
                          <Skeleton className="h-8 w-[5.5rem] shrink-0 rounded-md" />
                        </div>
                      </div>
                      <div className="min-h-0 flex-1">
                        <div className="h-full min-h-0 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3">
                              <Skeleton className="h-[4.25rem] w-full rounded-lg bg-blue-50" />
                              <Skeleton className="h-[4.25rem] w-full rounded-lg bg-green-50" />
                              <Skeleton className="h-[4.25rem] w-full rounded-lg bg-purple-50" />
                            </div>
                            <Skeleton className="h-20 w-full rounded-lg bg-gray-50" />
                            <div className="space-y-2">
                              <Skeleton className="h-3 w-28" />
                              {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full rounded border border-gray-200 bg-white" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-20" />
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
    </div>
  );
}

/** Mirrors ApplicationsPageWrapper + ApplicationsPage + ApplicationsTable shell. */
export function RecruitmentApplicationsSkeleton() {
  const aria = useRecruitmentLoadingAria();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-44 max-w-[90%]" />
                      <Skeleton className="h-3 w-full max-w-xl" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-36" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2">
                      <div className="rounded-md border bg-white p-2">
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                          <Skeleton className="h-9 min-w-[150px] flex-1" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full shrink-0 sm:w-auto sm:min-w-[5.5rem]" />
                        </div>
                      </div>

                      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-white">
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                          <div className="min-h-0 flex-1 overflow-x-auto">
                            <div className="min-w-[960px]">
                              <div className="border-b border-gray-200 bg-gray-50">
                                <div className="flex gap-2 px-6 py-3">
                                  {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-3 w-20 shrink-0" />
                                  ))}
                                </div>
                              </div>
                              <div className="divide-y divide-gray-200 bg-white">
                                {Array.from({ length: 8 }).map((_, i) => (
                                  <div key={i} className="flex items-start gap-4 px-6 py-4">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <Skeleton className="h-4 w-40 max-w-full" />
                                      <Skeleton className="h-3 w-52 max-w-full" />
                                      <Skeleton className="h-3 w-36 max-w-full" />
                                    </div>
                                    <Skeleton className="h-4 w-32 shrink-0" />
                                    <Skeleton className="h-4 w-16 shrink-0" />
                                    <Skeleton className="h-4 w-28 shrink-0" />
                                    <div className="hidden min-w-[120px] flex-1 space-y-1 md:block">
                                      <Skeleton className="h-3 w-full max-w-[200px]" />
                                      <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                                    <div className="shrink-0 space-y-1">
                                      <Skeleton className="h-3 w-20" />
                                      <Skeleton className="h-3 w-16" />
                                    </div>
                                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                                  </div>
                                ))}
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
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors IntervieweesPage + IntervieweeTab: filters row + wide applications-style table (min-w 1280px). */
export function RecruitmentIntervieweesSkeleton() {
  const aria = useRecruitmentLoadingAria();
  const headerCols = [72, 88, 64, 56, 80, 64, 56, 48, 56, 72, 72, 72, 48, 88, 72, 40];
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-44 max-w-[90%]" />
                      <Skeleton className="h-3 w-full max-w-xl" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 w-36" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <div className="space-y-6">
                      <div className="rounded-md border bg-white p-2">
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                          <Skeleton className="h-9 min-w-[150px] flex-1" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                          <Skeleton className="h-9 w-full sm:w-[130px]" />
                        </div>
                      </div>

                      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border bg-white">
                        <div className="w-full max-w-full min-w-0 overflow-x-auto seamless-scroll nested-scroll-touch-chain">
                          <div className="min-w-[1280px]">
                            <div className="border-b border-gray-200 bg-gray-50">
                              <div className="flex flex-nowrap items-center gap-2 px-4 py-3">
                                {headerCols.map((w, i) => (
                                  <Skeleton
                                    key={i}
                                    className="h-3 shrink-0"
                                    style={{ width: `${w}px` }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="divide-y divide-gray-100 bg-white">
                              {Array.from({ length: 6 }).map((_, ri) => (
                                <div
                                  key={ri}
                                  className="flex flex-nowrap items-center gap-2 px-4 py-3"
                                >
                                  <div className="flex w-[160px] shrink-0 items-center gap-2">
                                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                                    <Skeleton className="h-4 w-24 min-w-0 flex-1" />
                                  </div>
                                  <Skeleton className="h-3 w-[180px] shrink-0" />
                                  <Skeleton className="h-3 w-[100px] shrink-0" />
                                  <Skeleton className="h-3 w-[72px] shrink-0" />
                                  <Skeleton className="h-3 w-[140px] shrink-0" />
                                  <Skeleton className="h-3 w-[100px] shrink-0" />
                                  <Skeleton className="h-3 w-[72px] shrink-0" />
                                  <Skeleton className="h-3 w-[56px] shrink-0" />
                                  <Skeleton className="h-3 w-[88px] shrink-0" />
                                  <Skeleton className="h-5 w-[88px] shrink-0 rounded-full" />
                                  <Skeleton className="h-5 w-[88px] shrink-0 rounded-full" />
                                  <Skeleton className="h-3 w-[96px] shrink-0" />
                                  <Skeleton className="h-3 w-[56px] shrink-0" />
                                  <Skeleton className="h-3 w-[88px] shrink-0" />
                                  <Skeleton className="h-3 w-[140px] shrink-0" />
                                  <Skeleton className="sticky right-0 h-8 w-8 shrink-0 rounded-md bg-white shadow-sm ring-1 ring-gray-100" />
                                </div>
                              ))}
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
        </div>
      </div>
    </div>
  );
}
