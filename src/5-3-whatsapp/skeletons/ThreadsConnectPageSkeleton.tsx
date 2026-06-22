import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Layout mirror for `/omnichannel/integrations/threads` — same shell pattern as
 * `WhatsAppConnectPageSkeleton`, with Threads connect panel markup inside.
 */
export function ThreadsConnectPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="min-w-0 max-w-full px-1 py-3" aria-hidden>
                  <div className="mb-3 min-w-0">
                    <Skeleton className="mb-0.5 h-7 w-36 max-w-[55%]" />
                    <Skeleton className="h-3 w-full max-w-lg" />
                  </div>
                  <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
                    <nav className="flex min-w-0 flex-nowrap gap-x-6">
                      {['w-32', 'w-36', 'w-40', 'w-28', 'w-24'].map((w, i) => (
                        <div
                          key={i}
                          className="flex shrink-0 items-center space-x-1.5 border-b-2 border-transparent py-1.5 px-1"
                        >
                          <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                          <Skeleton className={`h-3.5 shrink-0 rounded-sm ${w}`} />
                        </div>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              <div className="mt-2 grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] lg:items-start">
                      <Card className="flex min-h-0 min-w-0 flex-col lg:max-h-[calc(100vh-180px)]">
                        <CardHeader className="shrink-0 space-y-1 pb-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                            <div className="min-w-0">
                              <Skeleton className="h-7 w-36 max-w-full" />
                              <Skeleton className="mt-0.5 h-3 w-44 max-w-full" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="scrollbar-hide nested-scroll-touch-chain seamless-scroll flex min-h-0 flex-1 flex-col space-y-3 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <div className="space-y-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Skeleton className="h-[3.25rem] w-full rounded-lg" />
                              <Skeleton className="h-[3.25rem] w-full rounded-lg" />
                            </div>
                          </div>
                          <Skeleton className="h-10 w-full rounded-md" />
                          <div className="border-t border-slate-200 pt-3">
                            <Skeleton className="h-3 w-44 max-w-full" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="flex min-h-0 min-w-0 flex-col">
                        <CardHeader className="shrink-0 pb-3">
                          <Skeleton className="h-5 w-36 max-w-full" />
                        </CardHeader>
                        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
                          <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                                <div className="min-w-0 space-y-2">
                                  <Skeleton className="h-4 w-28 max-w-full" />
                                  <Skeleton className="h-3 w-36 max-w-full" />
                                </div>
                              </div>
                              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                            </div>
                            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                                <div className="min-w-0 space-y-2">
                                  <Skeleton className="h-4 w-32 max-w-full" />
                                  <Skeleton className="h-3 w-40 max-w-full" />
                                </div>
                              </div>
                              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
