import { Skeleton } from '@/shared/components/ui/skeleton';
import { SocialMediaHeaderSkeletonSlot } from '@/6-1-dashboard/skeletons/SocialMediaHeaderSkeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

/** Selaras warna kartu `CalendarStats` (urutan sama). */
const STAT_CARD_SHELL = [
  'border-blue-200 bg-blue-50',
  'border-red-200 bg-red-50',
  'border-orange-200 bg-orange-50',
  'border-amber-200 bg-amber-50',
  'border-green-200 bg-green-50',
  'border-green-300 bg-green-100',
] as const;

/** Selaras baris Monthly Statistics di `ContentCalendarOverview` (overview tab). */
const OVERVIEW_STAT_SHELL = [
  'bg-gray-50',
  'bg-red-50',
  'bg-orange-50',
  'bg-amber-50',
  'bg-green-50',
  'bg-green-100 border border-green-300',
] as const;

/**
 * Skeleton khusus `/digital-marketing/social-media/content-calendar` —
 * mirror struktur DOM halaman: `HeaderAndTab`, `CalendarHeader`, `CalendarStats`,
 * `CalendarGrid`, `CalendarGridFooter`, `ContentCalendarOverview` + sidebar footer.
 */
export function ContentCalendarPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('contentCalendar.loadingAria', 'Memuat kalender konten');

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <SocialMediaHeaderSkeletonSlot activeTabId="content-calendar" />

              <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-9 flex min-h-0 w-full min-w-0 flex-col gap-1 overflow-hidden">
                  <div className="flex-shrink-0">
                    <div className="rounded-md border bg-white p-2">
                      <div className="space-y-3">
                        <div className="flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                            <Skeleton className="h-7 w-[min(100%,15rem)] max-w-[55vw] rounded-sm" />
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-7 min-w-[200px] rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            {Array.from({ length: 7 }).map((_, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
                                <Skeleton
                                  className={cn(
                                    'h-3 rounded-sm',
                                    i % 3 === 0 ? 'w-28' : i % 3 === 1 ? 'w-32' : 'w-24',
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                            <Skeleton className="h-8 w-[180px] rounded-md" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex flex-col rounded-md border p-4',
                            STAT_CARD_SHELL[i] ?? 'border-slate-200 bg-slate-50',
                          )}
                        >
                          <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                            <Skeleton className="h-4 w-[55%] max-w-[140px] rounded-sm" />
                            <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                          </div>
                          <div className="mt-auto flex flex-col">
                            <Skeleton className="h-8 w-12 rounded-sm" />
                            <Skeleton className="mt-1 h-3 w-24 rounded-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 max-h-[calc(100vh-320px)] flex-1 overflow-y-auto overflow-x-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="-mt-4 mb-2 grid grid-cols-7 gap-1 py-2">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <Skeleton
                            key={`wd-${i}`}
                            className="h-10 w-full rounded-md p-2 sm:h-11"
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 pt-2">
                        {Array.from({ length: 42 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex aspect-square min-h-0 flex-col overflow-hidden rounded-sm border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <Skeleton className="mb-1 h-4 w-5 rounded-sm" />
                            <Skeleton className="mt-auto h-2 w-full rounded-sm opacity-60" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                      <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-2 py-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
                          <Skeleton className="h-3 w-[4.5rem] rounded-sm" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {['Content Types', 'Services', 'Sub Services', 'Content Pillars', 'Social Media Names'].map(
                            (_, j) => (
                              <div key={j} className="flex items-center gap-0.5">
                                <Skeleton className="h-3 w-16 rounded-sm" />
                                <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex min-h-0 w-full min-w-0 flex-col overflow-hidden">
                  <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[5px] border bg-white">
                    <div className="shrink-0 border-b px-4 pb-2 pt-2">
                      <div className="mb-2 grid h-9 w-full grid-cols-3 gap-0 overflow-hidden rounded-[5px] bg-muted p-0">
                        <Skeleton className="h-full w-full rounded-none bg-primary/20" />
                        <Skeleton className="h-full w-full rounded-none" />
                        <Skeleton className="h-full w-full rounded-none" />
                      </div>
                      <Skeleton className="h-3 w-28 rounded-sm" />
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 seamless-scroll nested-scroll-touch-chain">
                      <div className="space-y-2">
                        <Skeleton className="mb-3 h-3 w-36 rounded-sm" />
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center justify-between rounded p-2',
                              OVERVIEW_STAT_SHELL[i] ?? 'bg-gray-50',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                              <Skeleton
                                className={cn(
                                  'h-3 rounded-sm',
                                  i === 0 ? 'w-24' : i === 5 ? 'w-32' : 'w-28',
                                )}
                              />
                            </div>
                            <Skeleton className="h-4 w-6 shrink-0 rounded-sm" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-1">
                      <div className="flex min-h-8 flex-wrap items-center gap-x-1 gap-y-0.5">
                        <Skeleton className="h-3 w-16 rounded-sm" />
                        <Skeleton className="mx-0.5 h-3 w-1 rounded-sm opacity-40" />
                        <Skeleton className="h-3 w-20 rounded-sm" />
                        <Skeleton className="mx-0.5 h-3 w-1 rounded-sm opacity-40" />
                        <Skeleton className="h-3 w-24 rounded-sm" />
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
  );
}
