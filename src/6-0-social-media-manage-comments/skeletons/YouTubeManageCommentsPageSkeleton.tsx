import { Skeleton } from "@/shared/components/ui/skeleton";
import { SocialMediaPerformanceHeaderAndTab } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";

export function YouTubeManageCommentsPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 shrink-0">
          <SocialMediaPerformanceHeaderAndTab />
        </div>
        <div className="flex max-h-[calc(100vh-120px)] min-h-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex w-[180px] shrink-0 flex-col border-r border-gray-200 bg-gray-50/80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <Skeleton className="mb-2 h-9 w-full" />
            <Skeleton className="mt-auto h-9 w-full" />
          </div>
          <aside className="flex w-[320px] shrink-0 flex-col border-r border-gray-200">
            <div className="border-b border-gray-100 px-3 pb-2 pt-3">
              <div className="mb-2 flex justify-center gap-5">
                <Skeleton className="h-5 w-5 rounded-sm" />
                <Skeleton className="h-5 w-5 rounded-sm" />
                <Skeleton className="h-5 w-5 rounded-sm" />
                <Skeleton className="h-5 w-5 rounded-sm" />
                <Skeleton className="h-5 w-5 rounded-sm" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 border-b border-gray-100 px-3 py-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-gray-100 p-4">
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex flex-1 flex-col items-center bg-gray-50/60 p-4">
              <div className="w-full max-w-[680px]">
                <Skeleton className="mb-4 aspect-video w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
