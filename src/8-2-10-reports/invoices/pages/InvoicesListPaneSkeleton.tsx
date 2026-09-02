import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Summary + table skeleton — keeps toolbar stable while invoices fetch. */
export function InvoicesListPaneSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.invoices.loadingAria", "Loading invoices report");

  return (
    <div className="min-w-0 space-y-4" aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`flex justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
              i % 2 === 1 ? "bg-muted/10" : ""
            }`}
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
