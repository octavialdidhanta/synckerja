import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeleton } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';

type ScriptGeneratorPageSkeletonMode = 'route' | 'overlay';

function FormColumnSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
        <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 px-3 py-2">
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3">
                <Skeleton className="mb-2 h-5 w-48 rounded-sm" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiddlePanelSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
        <div className="flex min-h-[220px] flex-1 flex-col p-4">
          <Skeleton className="mb-3 h-4 w-full max-w-md rounded-sm" />
          <Skeleton className="min-h-[160px] flex-1 w-full rounded-lg" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanelSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-full">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <Skeleton className="mb-4 h-4 w-56 rounded-sm" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MainGridSkeleton() {
  return (
    <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 min-h-[calc(100vh-120px)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.33fr)] lg:grid-rows-1 lg:[grid-template-rows:minmax(0,1fr)]">
      <FormColumnSkeleton />
      <MiddlePanelSkeleton />
      <RightPanelSkeleton />
    </div>
  );
}

/**
 * Skeleton untuk `/digital-marketing/social-media/script-generator` (layout 3 kolom desktop).
 */
export function ScriptGeneratorPageSkeleton({
  mode = 'route',
  headerActiveTabId = 'script-generator',
}: {
  mode?: ScriptGeneratorPageSkeletonMode;
  headerActiveTabId?: string;
}) {
  const inner = (
    <>
      <SocialMediaHeaderSkeleton activeTabId={headerActiveTabId} />
      <MainGridSkeleton />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </>
  );

  if (mode === 'overlay') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">{inner}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">{inner}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
