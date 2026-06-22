import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

function FacebookPageRowSkeleton() {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <Skeleton className="h-4 w-36 max-w-full" />
          <Skeleton className="mt-1 h-3 w-24 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
    </div>
  );
}

/**
 * Layout mirror for `/omnichannel/integrations/facebook` — same shell pattern as
 * `ThreadsConnectPageSkeleton` / `WhatsAppConnectPageSkeleton`.
 */
export function FacebookConnectPageSkeleton() {
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
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:items-stretch">
                      <Card className="flex h-full min-h-0 min-w-0 flex-col">
                        <CardHeader className="shrink-0">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                            <Skeleton className="h-7 w-52 max-w-full" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Skeleton className="h-10 w-full rounded-md" />
                          <Skeleton className="h-10 w-full rounded-md" />
                          <div className="border-t border-slate-200 pt-3">
                            <Skeleton className="h-3 w-44 max-w-full" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="flex h-full min-h-0 min-w-0 flex-col">
                        <CardHeader className="shrink-0">
                          <Skeleton className="h-7 w-44 max-w-full" />
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col">
                          <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <FacebookPageRowSkeleton />
                            <FacebookPageRowSkeleton />
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
