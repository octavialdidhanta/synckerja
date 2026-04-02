import { Skeleton } from "@/shared/components/ui/skeleton";

/** Matches `HRISSubscriptionPlansTab` layout (main + comparison sidebar). */
export function PlansPageSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden">
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-9">
        <div className="flex max-md:min-h-[360px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Skeleton className="mb-4 h-24 w-full rounded-lg" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`plan-card-skel-${i}`} className="space-y-3 rounded-lg border border-border p-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-20 w-full rounded-md" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-h-10 flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      </div>
      <div className="col-span-12 flex min-h-0 flex-col md:col-span-3">
        <div className="flex max-md:min-h-[280px] min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-full max-w-[200px]" />
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`plans-sidebar-row-${i}`} className="h-6 w-full" />
              ))}
            </div>
          </div>
          <div className="flex min-h-10 flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
