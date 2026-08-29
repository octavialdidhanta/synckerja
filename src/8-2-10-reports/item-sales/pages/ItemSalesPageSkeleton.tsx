import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Layout-matched skeleton for Item Sales route content pane. */
export function ItemSalesPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.itemSales.loadingAria", "Loading item sales report");

  return (
    <div className="min-w-0 space-y-4" aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-[220px]" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
