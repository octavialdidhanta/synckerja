import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type MetaAdsInterestResearchPageSkeletonProps = {
  /** False when HeaderAndTab is already rendered by the live page shell. */
  includeHeader?: boolean;
};

function InterestResearchBodySkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="w-[180px] shrink-0 border-r border-gray-200 bg-gray-50/80 p-3">
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="mb-1 h-10 w-full rounded-md" />
        <Skeleton className="mb-4 h-10 w-full rounded-md" />
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="mb-1 h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
        <Skeleton className="mb-3 h-10 w-full max-w-xl rounded-md" />
        <Skeleton className="mb-2 h-8 w-64 rounded-md" />
        <Skeleton className="h-full min-h-[240px] w-full rounded-md" />
      </div>
      <div className="hidden w-[320px] shrink-0 border-l border-gray-200 xl:block">
        <div className="border-b border-gray-200 px-4 py-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1 h-3 w-full" />
        </div>
        <div className="p-3">
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function MetaAdsInterestResearchPageSkeleton({
  includeHeader = true,
}: MetaAdsInterestResearchPageSkeletonProps) {
  if (!includeHeader) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-busy>
        <InterestResearchBodySkeleton />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans",
      )}
      aria-busy
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 min-w-0 shrink-0">
          <HeaderAndTab />
        </div>
        <InterestResearchBodySkeleton />
      </div>
    </div>
  );
}
