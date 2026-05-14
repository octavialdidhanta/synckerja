import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Skeleton `/omnichannel/livechat` — mirror DOM `WhatsAppInboxPage`
 * untuk PageAccessGuard loadingShell, Suspense fallback, dan overlay data.
 */
export function WhatsAppLivechatPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-muted font-sans">
      <div className="flex flex-1 min-h-0">
        <div className="flex min-h-0 flex-1 flex-col pl-2 pr-4 pb-4 sm:pl-3">
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
              <div className="min-w-0 max-w-full px-1 py-3">
                <div className="mb-3 min-w-0">
                  <Skeleton className="mb-0.5 h-7 w-16 max-w-[40%] rounded-md" />
                  <Skeleton className="h-3 w-full max-w-md rounded-sm" />
                </div>
                <div className="-mb-3 min-w-0 overflow-x-hidden">
                  <div className="flex min-w-0 flex-nowrap gap-x-6">
                    <Skeleton className="h-8 w-24 shrink-0 rounded-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-row max-w-full rounded-lg border border-gray-200 shadow-sm bg-white max-h-[calc(100vh-120px)]">
              <aside
                className="flex-shrink-0 border-r border-gray-200 flex flex-col min-h-0 bg-white"
                style={{ width: '20rem', minWidth: '20rem' }}
                aria-hidden
              >
                <div className="flex-shrink-0 px-2 py-2 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Skeleton className="h-8 min-w-[6rem] max-w-[10rem] flex-1 rounded-md" />
                    <Skeleton className="h-8 w-[7.5rem] shrink-0 rounded-md" />
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden px-2 py-2 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-[12rem] max-w-[70%] rounded-sm" />
                        <Skeleton className="h-3 w-full max-w-[14rem] rounded-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
              <main
                className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-white items-center justify-center p-4"
                aria-hidden
              >
                <Skeleton className="h-4 w-64 max-w-[min(100%,16rem)] rounded-sm" />
                <Skeleton className="mt-2 h-4 w-48 max-w-[min(100%,12rem)] rounded-sm opacity-70" />
              </main>
              <aside
                className="flex-shrink-0 border-l border-gray-200 flex flex-col min-h-0 bg-white"
                style={{ width: '20rem', minWidth: '20rem' }}
                aria-hidden
              >
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden p-4 space-y-4">
                  <Skeleton className="h-4 w-36 rounded-sm" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-4 w-32 rounded-sm" />
                  <Skeleton className="h-24 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
