import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function OperationsDashboardHeaderAndTab() {
  const { t } = useAppTranslation();
  const title = t("operationsDashboard.header.title", "Dashboard");
  const description = t(
    "operationsDashboard.header.subtitle",
    "Snapshot of sales performance for this month across all outlets.",
  );

  return (
    <div className="px-1 py-3">
      <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

OperationsDashboardHeaderAndTab.displayName = "OperationsDashboardHeaderAndTab";
