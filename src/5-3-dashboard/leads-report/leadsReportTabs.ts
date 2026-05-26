export const LEADS_REPORT_MAIN_TAB_IDS = [
  "overview",
  "source-performance",
  "consultant-performance",
] as const;

export const LEADS_REPORT_IDLE_TAB_ID = "idle-agents" as const;

export const LEADS_REPORT_VIEW_PARAM = "report";
export const LEADS_REPORT_TAB_PARAM = "reportTab";

export type LeadsReportMainTabId = (typeof LEADS_REPORT_MAIN_TAB_IDS)[number];
export type LeadsReportTabId = LeadsReportMainTabId | typeof LEADS_REPORT_IDLE_TAB_ID;

export function isMainReportTab(tab: string): tab is LeadsReportMainTabId {
  return (LEADS_REPORT_MAIN_TAB_IDS as readonly string[]).includes(tab);
}

export function isIdleAgentsTab(tab: string): boolean {
  return tab === LEADS_REPORT_IDLE_TAB_ID;
}

export function normalizeReportTab(
  tab: string | null | undefined,
  canViewIdleAgents: boolean,
): LeadsReportTabId {
  if (tab === LEADS_REPORT_IDLE_TAB_ID && canViewIdleAgents) {
    return LEADS_REPORT_IDLE_TAB_ID;
  }
  if (tab && isMainReportTab(tab)) {
    return tab;
  }
  return "overview";
}
