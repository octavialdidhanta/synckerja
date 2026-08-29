import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  completed: number;
  cancelled: number;
};

export function TableReportSummary({ completed, cancelled }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="flex flex-wrap gap-6 py-3">
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{completed}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("tableManagement.report.completedOrders", "Completed Orders")}
        </p>
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{cancelled}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("tableManagement.report.cancelledOrders", "Cancelled Orders")}
        </p>
      </div>
    </div>
  );
}
