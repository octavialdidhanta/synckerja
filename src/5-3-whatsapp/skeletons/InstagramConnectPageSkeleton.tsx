import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

type InstagramConnectPageSkeletonMode = 'route' | 'overlay';

/** Mirrors `HeaderAndTab` CRM block (title + 6 tabs). */
function CrmHeaderTabSkeleton() {
  const tabWidths = ['w-24', 'w-36', 'w-32', 'w-36', 'w-36', 'w-24'] as const;
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

function InstagramConnectMainSkeleton() {
  return (
    <>
      <div className="mb-1 min-w-0 shrink-0">
        <CrmHeaderTabSkeleton />
      </div>

      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col gap-6">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                {/* Left column — mirror Connect Instagram card + webhook block */}
                <Card className="flex h-full min-h-0 flex-col">
                  <CardHeader className="shrink-0 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-6 w-full max-w-[14rem] rounded-md" />
                        <Skeleton className="h-3.5 w-full max-w-sm rounded-sm" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-3 w-full max-w-xs rounded-sm" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-3 w-full max-w-md rounded-sm" />
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <div className="mb-4 flex items-center gap-2">
                        <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                        <Skeleton className="h-4 w-44 max-w-full rounded-sm" />
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                          <Skeleton className="h-3 w-40 rounded-sm" />
                          <Skeleton className="h-4 w-full rounded-sm" />
                          <Skeleton className="h-8 w-14 shrink-0 rounded-md" />
                        </div>
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                          <Skeleton className="h-3 w-28 rounded-sm" />
                          <Skeleton className="h-9 w-full rounded-md" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Right column — Connected accounts */}
                <Card className="flex h-full min-h-0 flex-col">
                  <CardHeader className="shrink-0 space-y-2">
                    <Skeleton className="h-7 w-48 max-w-full rounded-md" />
                    <Skeleton className="h-4 w-full max-w-lg rounded-sm" />
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                    <div className="space-y-4 rounded-xl border border-purple-200/70 bg-purple-50/60 p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-5 w-32 max-w-full rounded-sm" />
                            <Skeleton className="h-4 w-24 rounded-sm" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                      </div>
                    </div>
                    <div className="space-y-4 rounded-xl border border-purple-200/40 bg-purple-50/40 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-5 w-36 max-w-full rounded-sm" />
                            <Skeleton className="h-4 w-28 rounded-sm" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </>
  );
}

/**
 * Skeleton `/operations/consultant/instagram/connect` — same DOM shell as the live page for
 * PageAccessGuard `loadingShell`, Suspense fallback, and in-page overlay (Loading Skeleton rule).
 */
export function InstagramConnectPageSkeleton({ mode = 'route' }: { mode?: InstagramConnectPageSkeletonMode }) {
  const scrollInner = (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
        <InstagramConnectMainSkeleton />
      </div>
    </div>
  );

  const paddedColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
      <div className="flex h-full min-h-0 min-w-0 w-full flex-col">{scrollInner}</div>
    </div>
  );

  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden font-sans">
        {paddedColumn}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      {paddedColumn}
    </div>
  );
}
