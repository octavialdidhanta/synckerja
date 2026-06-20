import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

type FacebookConnectPageSkeletonMode = 'route' | 'overlay';

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

function FacebookConnectMainSkeleton() {
  return (
    <>
      <div className="mb-1 min-w-0 shrink-0">
        <CrmHeaderTabSkeleton />
      </div>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr]">
              <Card className="flex min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <Skeleton className="h-12 w-48 rounded-lg" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-md" />
                </CardContent>
              </Card>
              <Card className="flex min-h-0 flex-col">
                <CardHeader className="shrink-0">
                  <Skeleton className="h-6 w-40 rounded-md" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function FacebookConnectPageSkeleton({ mode = 'route' }: { mode?: FacebookConnectPageSkeletonMode }) {
  const inner = (
    <div className="flex min-h-full min-w-0 flex-col">
      <FacebookConnectMainSkeleton />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </div>
  );

  if (mode === 'overlay') {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
          {inner}
        </div>
      </div>
    </div>
  );
}
