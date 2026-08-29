import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Layout-matched skeleton for Served By Sales route content pane. */
export function ServedBySalesPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.servedBySales.loadingAria", "Loading served-by report");

  return (
    <div className="min-w-0 space-y-4" aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-96" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="border-b border-border bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-3 w-full max-w-lg" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`flex justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
              i % 3 === 1 ? "bg-muted/10 pl-8" : ""
            }`}
          >
            <Skeleton className={i % 3 === 1 ? "h-4 w-24" : "h-4 w-32"} />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
