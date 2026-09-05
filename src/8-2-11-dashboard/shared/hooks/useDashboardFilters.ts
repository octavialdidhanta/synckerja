import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { salesSummaryRangeToTimestamps } from "@/8-2-10-reports/sales-summary/lib/salesSummaryDatePresets";
import type { SalesSummaryDateRange } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";
import {
  dashboardStateToSearchParams,
  parseDashboardUrlState,
  type DashboardTab,
  type DashboardUrlState,
} from "../lib/dashboardUrlState";

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseDashboardUrlState(searchParams), [searchParams]);
  const timeFilter = useMemo(
    () => ({ allDay: true as const, startTime: "00:00", endTime: "23:59" }),
    [],
  );
  const timestamps = useMemo(
    () => salesSummaryRangeToTimestamps({
      fromYmd: state.dateRange.from,
      toYmd: state.dateRange.to,
      ...timeFilter,
    }),
    [state.dateRange.from, state.dateRange.to, timeFilter],
  );

  const updateState = useCallback((patch: Partial<DashboardUrlState>) => {
    setSearchParams(
      dashboardStateToSearchParams({ ...state, ...patch }),
      { replace: true },
    );
  }, [setSearchParams, state]);

  return {
    ...state,
    ...timestamps,
    timeFilter,
    setTab: (tab: DashboardTab) => updateState({ tab }),
    setOutletId: (outletId: string | null) => updateState({ outletId }),
    setCompareOutletIds: (compareOutletIds: string[]) => updateState({ compareOutletIds }),
    setDateRange: (dateRange: SalesSummaryDateRange) => updateState({ dateRange }),
  };
}

export type DashboardFilters = ReturnType<typeof useDashboardFilters>;
