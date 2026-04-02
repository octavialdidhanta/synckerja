import { Skeleton } from "@/shared/components/ui/skeleton";

/** Mirrors live /employees/add shell (h-dvh, main scroll, card) to avoid layout jump on hard reload. */
export function AddEmployeePageSkeleton() {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-gray-50" aria-busy="true">
      <span className="sr-only">Loading</span>
      <main className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-12 pt-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="container mx-auto max-w-4xl">
          <Skeleton className="mb-4 h-9 w-44 rounded-md" />
          <div className="rounded-lg border border-gray-200 bg-card shadow-sm">
            <div className="space-y-4 p-6">
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="flex gap-1 rounded-lg bg-muted/80 p-1">
                <Skeleton className="h-11 flex-1 rounded-md" />
                <Skeleton className="h-11 flex-1 rounded-md" />
                <Skeleton className="h-11 flex-1 rounded-md" />
              </div>
              <Skeleton className="h-[320px] w-full rounded-lg" />
              <div className="flex justify-between gap-2 pt-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
