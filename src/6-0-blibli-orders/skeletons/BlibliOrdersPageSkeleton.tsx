import { Skeleton } from '@/shared/components/ui/skeleton';
import { BlibliOrdersHeaderAndTab } from '../container/BlibliOrdersHeaderAndTab';

export function BlibliOrdersPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide flex h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full w-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <BlibliOrdersHeaderAndTab />
            </div>
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
              <div className="col-span-12 flex min-h-[560px] flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-56" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <div className="flex gap-4 border-b border-gray-100 pb-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            </div>
            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
