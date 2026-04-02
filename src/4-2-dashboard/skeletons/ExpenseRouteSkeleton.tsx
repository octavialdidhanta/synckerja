import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Sama dengan akar scroll `IncomeDashboardSkeleton` / `ExpenseDashboardSkeleton` (bukan `bg-muted` penuh). */
const SHELL_SCROLL =
  "scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-100 font-sans";

export type ExpenseRouteSkeletonVariant = "reminder-bills";

type ExpenseRouteSkeletonProps = {
  variant: ExpenseRouteSkeletonVariant;
};

/**
 * Shell `/expenses/*` selain dashboard — tiap route halaman utama punya file skeleton sendiri;
 * ini untuk reminder-bills saja (route expense lain punya skeleton khusus).
 */
export function ExpenseRouteSkeleton({ variant }: ExpenseRouteSkeletonProps) {
  const { t } = useAppTranslation();
  const ariaByVariant: Record<ExpenseRouteSkeletonVariant, string> = {
    "reminder-bills": t("expenses.reminderBills.loadingAria", "Loading reminder bills"),
  };
  const aria = ariaByVariant[variant];

  return (
    <div className={SHELL_SCROLL} aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40 px-4 pb-4">
        <div className="mb-1 shrink-0 px-1 py-3">
          <div className="mb-3 min-w-0 space-y-1.5">
            <Skeleton className="h-7 w-56 max-w-[90vw]" />
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
          <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-9 shrink-0 ${i === 0 ? "w-36 sm:w-40" : "w-24 sm:w-28"}`}
              />
            ))}
          </div>
        </div>

        <div
          className={
            "grid min-h-[calc(100dvh-210px)] min-w-0 flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[760px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[860px] xl:grid-rows-1 xl:items-stretch"
          }
        >
          <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
            <div className="flex h-full min-w-0 flex-col gap-2">
              <div className="flex shrink-0 flex-wrap gap-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-32" />
              </div>
              <Skeleton className="min-h-[280px] w-full flex-1 rounded-lg border border-border bg-card/60" />
            </div>
          </div>
          <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
            <div className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
              <div className="shrink-0 border-b border-border px-4 py-1.5">
                <Skeleton className="mb-1 h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              <div className="min-h-0 flex-1 space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
      <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
    </div>
  );
}
