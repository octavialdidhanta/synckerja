import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Mirrors `SubscriptionSectionLayout` chrome so route-level loading never shows
 * a bare text spinner (avoids flicker + matches Loading Skeleton rules).
 */
export function SubscriptionShellSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 pb-2 pt-4">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
        <div className="mt-3 flex gap-6 border-b border-transparent">
          <Skeleton className="h-8 w-28 rounded-none" />
          <Skeleton className="h-8 w-24 rounded-none" />
          <Skeleton className="h-8 w-32 rounded-none" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-1">
        <div className="flex min-h-[240px] flex-1 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="min-h-[160px] flex-1 rounded-md bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
