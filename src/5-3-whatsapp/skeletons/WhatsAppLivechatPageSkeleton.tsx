import { Skeleton } from '@/shared/components/ui/skeleton';

const THREAD_BUBBLES: { align: 'start' | 'end'; lines: string[] }[] = [
  { align: 'start', lines: ['w-52', 'w-36'] },
  { align: 'end', lines: ['w-44'] },
  { align: 'start', lines: ['w-40'] },
  { align: 'end', lines: ['w-56', 'w-32'] },
  { align: 'start', lines: ['w-48', 'w-28'] },
];

/**
 * Skeleton `/omnichannel/livechat` — mirror DOM `WhatsAppInboxPage`
 * untuk PageAccessGuard loadingShell, Suspense fallback, dan overlay data.
 */
export function WhatsAppLivechatPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-surface-muted font-sans">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0">
              <div className="min-w-0 max-w-full px-1 py-3">
                <div className="mb-3 min-w-0">
                  <Skeleton className="mb-0.5 h-7 w-32 max-w-[40%] rounded-md" />
                  <Skeleton className="h-3 w-full max-w-md rounded-sm" />
                </div>
                <div className="-mb-3 min-w-0 overflow-x-hidden">
                  <div className="flex min-w-0 flex-nowrap items-end gap-x-6">
                    <Skeleton className="h-8 w-[6.5rem] shrink-0 rounded-none border-b-2 border-brand-blue" />
                    <Skeleton className="h-8 w-20 shrink-0 rounded-none" />
                    <Skeleton className="h-8 w-40 shrink-0 rounded-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#efeae2]"
                aria-hidden
              >
                <div className="flex min-h-[60px] flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-[#f0f2f5] px-3 py-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40 max-w-[70%] rounded-sm" />
                    <Skeleton className="h-3 w-24 max-w-[40%] rounded-sm" />
                  </div>
                  <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-4 py-4">
                  {THREAD_BUBBLES.map((bubble, index) => (
                    <div
                      key={index}
                      className={`flex ${bubble.align === 'end' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] space-y-1.5 rounded-lg px-3 py-2 ${
                          bubble.align === 'end' ? 'bg-[#d9fdd3]' : 'bg-white'
                        }`}
                      >
                        {bubble.lines.map((width) => (
                          <Skeleton key={width} className={`h-3.5 ${width} max-w-full rounded-sm`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-shrink-0 px-3 pb-3">
                  <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-2">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                    <Skeleton className="h-4 min-w-0 flex-1 rounded-sm" />
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                  </div>
                </div>
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
                <div className="flex min-h-0 flex-1 items-center justify-center px-4">
                  <Skeleton className="h-4 w-48 max-w-full rounded-sm" />
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
