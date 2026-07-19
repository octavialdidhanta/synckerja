import { Skeleton } from '@/shared/components/ui/skeleton';
import { EcommerceChatHeaderAndTab } from '../container/EcommerceChatHeaderAndTab';

export function EcommerceChatPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide flex h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full w-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <EcommerceChatHeaderAndTab />
            </div>
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
              <div className="col-span-12 flex min-h-[560px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm lg:col-span-4">
                <div className="border-b border-gray-100 px-4 py-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-3 w-56" />
                </div>
                <div className="space-y-2 p-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
              <div className="col-span-12 flex min-h-[560px] flex-col rounded-lg border border-dashed border-gray-200 bg-white/60 shadow-sm lg:col-span-8">
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
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
