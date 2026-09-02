import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsPageSkeletonFrame } from "../../layout/ReportsPageSkeletonFrame";
import { InvoicesPageSkeleton } from "./InvoicesPageSkeleton";

/** Full-route skeleton for guard + Suspense on `/operations/reports/invoices`. */
export function InvoicesReportsRouteSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.invoices.loadingAria", "Loading invoices report");

  return (
    <ReportsPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
        <InvoicesPageSkeleton />
      </div>
    </ReportsPageSkeletonFrame>
  );
}
