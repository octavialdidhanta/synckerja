import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { TransactionsTabId } from "../layout/transactionsTabs";

/** List-area-only skeleton — keeps toolbar + sub-tabs stable while a tab fetches. */
export function TransactionsListPaneSkeleton({ tab }: { tab: TransactionsTabId }) {
  const { t } = useAppTranslation();
  const aria = t("reports.transactions.loadingAria", "Loading transactions report");

  return (
    <div className="min-w-0 space-y-4" aria-busy aria-label={aria}>
      <span className="sr-only">{aria}</span>
      {tab === "success" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`flex justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
              i % 2 === 1 ? "bg-muted/10" : ""
            }`}
          >
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
