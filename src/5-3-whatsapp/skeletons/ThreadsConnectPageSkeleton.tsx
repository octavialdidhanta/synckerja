import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

type ThreadsConnectPageSkeletonMode = 'route' | 'overlay';

function CrmHeaderTabSkeleton() {
  const tabWidths = ['w-32', 'w-36', 'w-36', 'w-28', 'w-28'] as const;
  return (
    <div className="min-w-0 max-w-full px-1 py-3" aria-hidden>
      <Skeleton className="mb-0.5 h-7 w-14 max-w-[40%] rounded-md" />
      <Skeleton className="mb-3 h-3 w-80 max-w-full rounded-sm" />
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6 py-0">
          {tabWidths.map((w, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center space-x-1.5 border-b-2 border-transparent py-1.5 px-1"
            >
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className={`h-4 shrink-0 rounded-sm ${w}`} />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ThreadsConnectMainSkeleton() {
  return (
    <>
      <div className="mb-1 min-w-0 shrink-0">
        <CrmHeaderTabSkeleton />
      </div>

      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col gap-6">
              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] lg:items-start">
                <Card className="flex min-h-0 min-w-0 flex-col lg:max-h-[calc(100vh-180px)]">
                  <CardHeader className="shrink-0 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-6 w-full max-w-[14rem] rounded-md" />
                        <Skeleton className="h-3.5 w-full max-w-sm rounded-sm" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-16 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                  </CardContent>
                </Card>

                <Card className="flex h-full min-h-0 min-w-0 flex-col">
                  <CardHeader className="shrink-0 space-y-2">
                    <Skeleton className="h-6 w-48 rounded-md" />
                    <Skeleton className="h-3.5 w-64 max-w-full rounded-sm" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Skeleton `/omnichannel/integrations/threads` — same DOM shell as the live page. */
export function ThreadsConnectPageSkeleton({ mode = 'route' }: { mode?: ThreadsConnectPageSkeletonMode }) {
  if (mode === 'overlay') {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <ThreadsConnectMainSkeleton />
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <ThreadsConnectMainSkeleton />
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
