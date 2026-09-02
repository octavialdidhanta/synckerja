import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsPageSkeletonFrame } from "../../layout/ReportsPageSkeletonFrame";
import { ShiftPageSkeleton } from "./ShiftPageSkeleton";

/** Full-route skeleton for guard + Suspense on `/operations/reports/shift`. */
export function ShiftReportsRouteSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("reports.shift.loadingAria", "Loading shift report");

  return (
    <ReportsPageSkeletonFrame ariaLabel={aria}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
        <ShiftPageSkeleton />
      </div>
    </ReportsPageSkeletonFrame>
  );
}
