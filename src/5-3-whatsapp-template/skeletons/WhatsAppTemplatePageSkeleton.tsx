import { Skeleton } from "@/shared/components/ui/skeleton";

/** Mirrors CRM `HeaderAndTab` (7 tabs) + template manager toolbar + table shell. */
function CrmHeaderTabSkeleton() {
  return (
    <div className="min-w-0 max-w-full px-1 py-3">
      <div className="mb-3 min-w-0 space-y-2">
        <Skeleton className="h-7 w-[min(100%,12rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex cursor-default items-center space-x-1.5 border-b-2 border-transparent py-1.5 px-1"
            >
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-24 shrink-0 rounded-sm sm:w-28" />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function WhatsAppTemplatePageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <CrmHeaderTabSkeleton />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex gap-6 border-b border-slate-200 pb-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-9 min-w-[140px] flex-1 rounded-md" />
                      <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
                      <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
                      <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
                      <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
                      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                      <div className="ml-auto flex shrink-0 gap-2">
                        <Skeleton className="h-9 w-20 rounded-md" />
                        <Skeleton className="h-9 w-32 rounded-md" />
                      </div>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 space-y-2 rounded-md border border-slate-200 p-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-sm" />
                      ))}
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
