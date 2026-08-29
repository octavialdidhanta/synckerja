import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Layout-matched skeleton for Gross Profit route content pane. */
export function GrossProfitPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.grossProfit.loadingAria", "Loading gross profit report");

  return (
    <div className="min-w-0 space-y-4" aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    </div>
  );
}
