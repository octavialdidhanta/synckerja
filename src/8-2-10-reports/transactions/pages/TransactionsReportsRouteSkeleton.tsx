import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsPageSkeletonFrame } from "../../layout/ReportsPageSkeletonFrame";
import { TransactionsPageSkeleton } from "./TransactionsPageSkeleton";

/** Full-route skeleton for guard + Suspense on `/operations/reports/transactions`. */
export function TransactionsReportsRouteSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.transactions.loadingAria", "Loading transactions report");

  return (
    <ReportsPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
        <TransactionsPageSkeleton />
      </div>
    </ReportsPageSkeletonFrame>
  );
}
