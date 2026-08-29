import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Void Items tab scaffold — structured void pipeline not yet available. */
export function TableReportVoidPanel() {
  const { t } = useAppTranslation();
  return (
    <div className="flex min-h-[280px] flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("tableManagement.report.voidItems", "Void Items")}
      </div>
      <div className="grid grid-cols-4 gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{t("tableManagement.report.colItems", "Items")}</span>
        <span>{t("tableManagement.report.colQty", "Qty")}</span>
        <span>{t("tableManagement.report.colReason", "Reason")}</span>
        <span>{t("tableManagement.report.colExecutedBy", "Executed By")}</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10 text-sm text-muted-foreground">
        {t("tableManagement.report.noItems", "No Item Found")}
      </div>
    </div>
  );
}
