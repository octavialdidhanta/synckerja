import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LEADS_REPORT_IDLE_TAB_ID,
  LEADS_REPORT_TAB_PARAM,
  LEADS_REPORT_VIEW_PARAM,
  normalizeReportTab,
  type LeadsReportTabId,
} from "./leadsReportTabs";

export function useLeadsReportTabState(canViewIdleAgents: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();

  const isReportView = searchParams.get("view") === LEADS_REPORT_VIEW_PARAM;

  const activeTab = useMemo(
    () => normalizeReportTab(searchParams.get(LEADS_REPORT_TAB_PARAM), canViewIdleAgents),
    [searchParams, canViewIdleAgents],
  );

  const setActiveTab = useCallback(
    (tab: LeadsReportTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("view", LEADS_REPORT_VIEW_PARAM);
          if (tab === "overview") {
            next.delete(LEADS_REPORT_TAB_PARAM);
          } else {
            next.set(LEADS_REPORT_TAB_PARAM, tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goToReportView = useCallback(
    (reportTab: LeadsReportTabId = "overview") => {
      setActiveTab(reportTab);
    },
    [setActiveTab],
  );

  const goToIdleAgents = useCallback(() => {
    if (!canViewIdleAgents) return;
    setActiveTab(LEADS_REPORT_IDLE_TAB_ID);
  }, [canViewIdleAgents, setActiveTab]);

  return {
    activeTab,
    setActiveTab,
    isReportView,
    isIdleAgentsView: isReportView && activeTab === LEADS_REPORT_IDLE_TAB_ID,
    goToReportView,
    goToIdleAgents,
  };
}
