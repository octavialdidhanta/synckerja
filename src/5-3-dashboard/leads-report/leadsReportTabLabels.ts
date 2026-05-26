import type { TFunction } from "i18next";

export function getLeadsReportTabLabel(t: TFunction, tab: string): string {
  if (tab === "overview") {
    return t("leadsManagement.reportSummary.tabOverview", "Overview");
  }
  if (tab === "source-performance") {
    return t("leadsManagement.reportSummary.tabSourcePerformance", "Source Performance");
  }
  if (tab === "consultant-performance") {
    return t("leadsManagement.reportSummary.tabConsultantPerformance", "Consultant Performance");
  }
  if (tab === "idle-agents") {
    return t("leadsManagement.reportSummary.tabIdleAgents", "Idle Agents");
  }
  return tab;
}
