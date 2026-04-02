import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type AccessPermissionsPageSkeletonProps = {
  srLabel?: string | null;
  className?: string;
};

export const AccessPermissionsPageSkeleton = ({
  srLabel = 'Loading access permissions',
  className,
}: AccessPermissionsPageSkeletonProps) => {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans',
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full min-w-0 flex-col">
                <div className="mb-1 shrink-0 px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="mt-2 h-4 w-80" />
                  </div>
                  <div className="-mb-3">
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>

                <div className="grid h-[min(1400px,calc(100dvh-120px))] min-h-[600px] min-w-0 w-full flex-none grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:h-[min(1180px,calc(100dvh-115px))] [@media(max-height:760px)]:h-[min(1000px,calc(100dvh-110px))]">
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                    <div className="bg-card border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm">
                      <div className="border-border shrink-0 border-b px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Skeleton className="h-6 w-56" />
                            <Skeleton className="mt-2 h-4 w-80" />
                          </div>
                          <Skeleton className="h-9 w-32" />
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 p-4">
                        <Skeleton className="h-full w-full min-h-0" />
                      </div>
                      <div className="border-border bg-muted/40 mt-2 shrink-0 rounded-md border px-4 py-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="bg-card border-border flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                        <div className="shrink-0 border-b px-4 py-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="mt-2 h-3 w-36" />
                        </div>
                        <div className="min-h-0 flex-1 p-4">
                          <Skeleton className="h-full w-full min-h-[200px]" />
                        </div>
                        <div className="border-border bg-muted/40 mt-2 shrink-0 rounded-md border px-4 py-2">
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
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
      </div>
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </div>
  );
};
