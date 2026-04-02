import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export function MeetingNotesPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('meetingNotes.page.loadingAria', 'Loading meeting notes');

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-1 h-7 w-24" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <div className="flex space-x-6">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-36" />
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-9 flex flex-col min-h-0">
                  <div className="flex-shrink-0 h-[56px] rounded-lg border border-gray-200 bg-white px-4 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-52 rounded-md" />
                        <Skeleton className="h-9 w-28 rounded-md" />
                        <Skeleton className="h-9 w-32 rounded-md" />
                        <Skeleton className="h-9 w-28 rounded-md" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-2 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-9 flex-1 rounded-md" />
                      <Skeleton className="h-9 w-36 rounded-md" />
                      <Skeleton className="h-9 w-24 rounded-md" />
                      <Skeleton className="h-9 w-10 rounded-md" />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="h-full flex flex-col min-h-0">
                      <div className="flex-1 min-h-0 p-4">
                        <Skeleton className="h-10 w-full rounded-md" />
                        <Skeleton className="mt-2 h-10 w-full rounded-md" />
                        <Skeleton className="mt-2 h-10 w-full rounded-md" />
                        <Skeleton className="mt-2 h-10 w-full rounded-md" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex flex-col min-h-0">
                  <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="shrink-0 px-4 py-1.5 border-b">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-1 h-3 w-28" />
                    </div>
                    <div className="flex-1 min-h-0 p-4">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="mt-2 h-10 w-full rounded-md" />
                      <Skeleton className="mt-2 h-10 w-full rounded-md" />
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

          <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

