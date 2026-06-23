import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  HABIT_TRACKER_MAIN_GRID,
  HABIT_TRACKER_TABLE_CARD,
} from "@/8-2-HabitTracker/layout/habitTrackerLayout";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function HabitTrackerPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("habitTracker.page.loadingAria", "Loading habit tracker");

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, "min-w-0")}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0 px-1 py-3">
                <div className="mb-3 min-w-0 space-y-1.5">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-28 shrink-0" />
                  ))}
                </div>
              </div>

              <div className={HABIT_TRACKER_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-w-0 flex-col">
                  <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
                    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                          <Skeleton className="mb-2 h-3 w-20" />
                          <Skeleton className="h-7 w-12" />
                        </div>
                      ))}
                    </div>

                    <div className="shrink-0 rounded-md border border-border bg-card p-2">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Skeleton className="h-9 min-w-[180px] flex-1 sm:max-w-xs" />
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-9 w-40" />
                      </div>
                    </div>

                    <div className={HABIT_TRACKER_TABLE_CARD}>
                      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm ring-1 ring-brand-blue/10">
                        <div className="shrink-0 border-b border-brand-blue/20 bg-brand-blue/[0.06] px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Skeleton className="h-6 w-32" />
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-7 w-7 rounded-md" />
                                <Skeleton className="h-5 w-28" />
                                <Skeleton className="h-7 w-7 rounded-md" />
                              </div>
                            </div>
                            <Skeleton className="h-9 w-28 rounded-md" />
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 p-3">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <Skeleton key={i} className="mt-2 h-8 w-full rounded first:mt-0" />
                          ))}
                        </div>
                        <div className="shrink-0 border-t border-gray-300 p-3">
                          <Skeleton className="h-24 w-full rounded-md" />
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
