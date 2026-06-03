import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Layout mirror for `/omnichannel/integrations/whatsapp` — used by PageAccessGuard,
 * Suspense fallback, and in-page overlay (Loading Skeleton rule).
 */
export function WhatsAppConnectPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="min-w-0 max-w-full px-1 py-3" aria-hidden>
                  <Skeleton className="mb-0.5 h-7 w-14 max-w-[40%]" />
                  <Skeleton className="mb-3 h-3 w-80 max-w-full" />
                  <div className="-mb-3 flex min-w-0 flex-nowrap gap-x-6 overflow-x-hidden">
                    {['w-36', 'w-40', 'w-28'].map((w, i) => (
                      <Skeleton key={i} className={`h-8 shrink-0 ${w}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                        <Card className="flex h-full min-h-0 flex-col">
                          <CardHeader className="shrink-0 space-y-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                              <div className="space-y-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-48 max-w-full" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col space-y-6 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-52" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Skeleton className="h-9 w-32" />
                              </div>
                            </div>
                            <div className="space-y-4 border-t border-slate-200 pt-6">
                              <div className="mb-4 flex items-center gap-2">
                                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-40" />
                                  <Skeleton className="h-3 w-56" />
                                </div>
                              </div>
                              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                                <Skeleton className="h-3 w-36" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-4 w-full max-w-md" />
                              </div>
                            </div>
                            <div className="space-y-4 border-t border-slate-200 pt-6">
                              <div className="mb-4 flex items-center gap-2">
                                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-28" />
                                  <Skeleton className="h-3 w-64 max-w-full" />
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                                  <Skeleton className="h-3 w-40" />
                                  <Skeleton className="h-4 w-full" />
                                  <Skeleton className="h-8 w-16" />
                                </div>
                                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                                  <Skeleton className="h-3 w-44" />
                                  <Skeleton className="h-4 w-full" />
                                  <Skeleton className="h-8 w-16" />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="flex h-full min-h-0 flex-col">
                          <CardHeader className="shrink-0 space-y-2">
                            <Skeleton className="h-6 w-56 max-w-full" />
                            <Skeleton className="h-4 w-full max-w-lg" />
                          </CardHeader>
                          <CardContent className="flex min-h-0 flex-1 flex-col">
                            <div className="min-h-0 flex-1 space-y-4">
                              <div className="space-y-5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-5 w-48 max-w-full" />
                                    <Skeleton className="h-4 w-24" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
                                  {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3">
                                      <Skeleton className="h-3 w-16" />
                                      <Skeleton className="h-4 w-full" />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-2 border-t border-emerald-200/60 pt-2">
                                  <Skeleton className="h-8 w-20" />
                                  <Skeleton className="h-8 w-36" />
                                  <Skeleton className="h-8 w-24" />
                                </div>
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
    </div>
  );
}
