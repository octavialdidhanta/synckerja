/**
 * Layout-matched skeleton for Share-to-Publish wizard (guard / Suspense / overlay).
 */
export default function ShareToPublishWizardPageSkeleton() {
  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-gray-100"
      aria-busy
      aria-label="Loading"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border/10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/20" />
        <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide flex-1 overflow-hidden">
            <div className="flex min-h-full flex-col gap-1.5 pt-1.5">
              <div className="h-16 animate-pulse rounded-xl bg-white" />
              <div className="h-72 animate-pulse rounded-xl bg-white" />
              <div className="space-y-2 rounded-xl bg-white p-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="flex items-center justify-between gap-2">
                  <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="flex gap-2 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 min-w-[58px] animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="min-h-[148px] animate-pulse rounded-xl bg-muted/80"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-xl bg-white p-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
                <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
                <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="space-y-2 rounded-xl bg-white p-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-28 w-full animate-pulse rounded-lg bg-muted" />
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
