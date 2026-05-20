import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Lightweight guard/Suspense fallback for routes that do not need a module-specific skeleton
 * in the initial App bundle (Lighthouse / first-load).
 */
export function StandardRouteLoadingShell() {
  return (
    <div
      className="flex min-h-[calc(100vh-120px)] min-w-0 flex-1 flex-col gap-2 px-4 pb-2 pt-2"
      aria-busy
      aria-label="Loading page"
    >
      <Skeleton className="h-9 w-48 max-w-full" />
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <Skeleton className="col-span-12 min-h-[320px] xl:col-span-9" />
        <Skeleton className="col-span-12 min-h-[200px] xl:col-span-3" />
      </div>
    </div>
  );
}
