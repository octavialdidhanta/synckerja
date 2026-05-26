import { LEADS_REPORT_IDLE_TAB_ID, LEADS_REPORT_TAB_PARAM, LEADS_REPORT_VIEW_PARAM } from "./leadsReportTabs";

export function buildLeadsReportSearch(options?: { reportTab?: string }): string {
  const params = new URLSearchParams();
  params.set("view", LEADS_REPORT_VIEW_PARAM);
  const tab = options?.reportTab;
  if (tab && tab !== "overview") {
    params.set(LEADS_REPORT_TAB_PARAM, tab);
  }
  return `?${params.toString()}`;
}

export function buildLeadsIdleAgentsSearch(): string {
  return buildLeadsReportSearch({ reportTab: LEADS_REPORT_IDLE_TAB_ID });
}
