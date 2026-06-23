import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  MEETING_NOTES_MAIN_GRID,
  MEETING_NOTES_SIDEBAR_CARD,
  MEETING_NOTES_TABLE_CARD,
  MEETING_NOTES_TABLE_SECTION,
} from '@/8-1-meeting-notes/layout/meetingNotesLayout';

/**
 * Mirrors MeetingNotesPage / EmployeePage: scroll chain, HeaderAndTab, 9+3 grid.
 */
export function MeetingNotesPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('meetingNotes.page.loadingAria', 'Loading meeting notes');

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 w-full flex-1">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-1 h-7 w-24" />
                      <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex space-x-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-28" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={MEETING_NOTES_MAIN_GRID}>
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="mb-2 flex-shrink-0">
                        <div className="rounded-md border border-border bg-card px-4 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Skeleton className="h-9 w-52 rounded-md" />
                            <Skeleton className="h-9 w-28 rounded-md" />
                            <Skeleton className="h-9 w-32 rounded-md" />
                            <Skeleton className="h-9 w-28 rounded-md" />
                          </div>
                        </div>
                      </div>

                      <div className="mb-2 flex-shrink-0">
                        <div className="rounded-md border border-border bg-card p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Skeleton className="h-9 min-w-[180px] flex-1 rounded-md" />
                            <Skeleton className="h-9 w-36 rounded-md" />
                            <Skeleton className="h-9 w-24 rounded-md" />
                            <Skeleton className="h-9 w-10 rounded-md" />
                          </div>
                        </div>
                      </div>

                      <div className={MEETING_NOTES_TABLE_SECTION}>
                        <div className={MEETING_NOTES_TABLE_CARD}>
                          <div className="flex h-full min-h-0 min-w-0 flex-col">
                            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="mx-3 mt-2 h-10 w-[calc(100%-1.5rem)] rounded-md first:mt-3" />
                              ))}
                            </div>
                            <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                              <Skeleton className="h-3 w-44" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className={MEETING_NOTES_SIDEBAR_CARD}>
                        <div className="flex-shrink-0 border-b px-4 py-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="mt-1 h-3 w-28" />
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <div className="space-y-2 p-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full rounded-md" />
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
