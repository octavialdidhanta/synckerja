import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Layout mirror for `/omnichannel/integrations/email` — used by PageAccessGuard,
 * React.Suspense, and the in-page loading overlay (Loading Skeleton rule).
 */
export function EmailConnectPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              {/* HeaderAndTab mirror */}
              <div className="mb-1 min-w-0 shrink-0">
                <div className="min-w-0 max-w-full px-1 py-3">
                  <div className="mb-3 min-w-0 space-y-2">
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                  <div className="-mb-3 min-w-0">
                    <div className="flex min-w-0 flex-nowrap gap-x-6 border-b border-transparent pb-0">
                      {['w-36', 'w-40', 'w-28'].map((w, i) => (
                        <Skeleton key={i} className={`h-9 shrink-0 rounded-none ${w}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                        {/* Left card — mirrors <Card className="flex h-full min-h-0 flex-col"> */}
                        <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-card text-card-foreground shadow-sm">
                          <div className="flex shrink-0 flex-col space-y-3 p-6">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-3 w-full max-w-[280px]" />
                                <Skeleton className="h-3 w-full max-w-[220px]" />
                              </div>
                            </div>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-6 pt-0">
                            <Skeleton className="h-10 w-full rounded-md" />
                          </div>
                        </div>

                        {/* Right card */}
                        <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-card text-card-foreground shadow-sm">
                          <div className="flex shrink-0 flex-col space-y-1.5 p-6">
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-3 w-full max-w-lg" />
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col p-6 pt-0">
                            <div className="min-h-0 flex-1 space-y-4">
                              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <Skeleton className="h-4 w-56 max-w-full" />
                                      <Skeleton className="h-3 w-full max-w-xs" />
                                      <Skeleton className="h-3 w-24" />
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-8 w-10" />
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <Skeleton className="h-4 w-48 max-w-full" />
                                      <Skeleton className="h-3 w-full max-w-sm" />
                                      <Skeleton className="h-3 w-28" />
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-8 w-10" />
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
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
