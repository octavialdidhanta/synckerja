import { Skeleton } from "@/shared/components/ui/skeleton";

/** Mirror `HRISSubscriptionPlansTab` (grid 9+3, three plan cards, add-ons sidebar). */
export function PlansPageSkeleton() {
  return (
    <div className="grid min-h-0 w-full min-w-0 max-w-full flex-1 grid-cols-12 gap-2 overflow-hidden">
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-9">
        <div className="flex max-md:min-h-[360px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4 p-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-border p-3">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-20 w-full rounded-md" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
          <div className="flex min-h-10 min-w-0 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <Skeleton className="h-3 w-32 max-w-[45%]" />
              <Skeleton className="h-3 w-28 max-w-[45%]" />
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-3">
        <div className="flex max-md:min-h-[280px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-3 w-full max-w-[200px]" />
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="mt-3 h-24 w-full rounded-md" />
            <Skeleton className="mt-4 h-6 w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
