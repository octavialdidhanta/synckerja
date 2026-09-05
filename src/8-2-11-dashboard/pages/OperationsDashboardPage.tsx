import { useCallback, useState } from "react";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { DashboardComparisonPanel } from "../comparison/components/DashboardComparisonPanel";
import { OperationsDashboardShell } from "../layout/OperationsDashboardShell";
import { useDashboardFilters } from "../shared/hooks/useDashboardFilters";
import type { DashboardTab } from "../shared/lib/dashboardUrlState";
import { DashboardSummaryPanel } from "../summary/components/DashboardSummaryPanel";

export default function OperationsDashboardPage() {
  const filters = useDashboardFilters();
  const [panelLoading, setPanelLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(filters.tab);

  // Adjust loading during render when tab changes (before child effects),
  // so a parent useEffect cannot overwrite the panel's "ready" report.
  if (filters.tab !== activeTab) {
    setActiveTab(filters.tab);
    setPanelLoading(true);
  }

  const handleLoadingChange = useCallback((loading: boolean) => {
    setPanelLoading(loading);
  }, []);

  const showContent = useDebouncedReady(!panelLoading);

  return (
    <OperationsDashboardShell showContent={showContent}>
      {filters.tab === "summary" ? (
        <DashboardSummaryPanel
          key="summary"
          outletId={filters.outletId}
          dateRange={filters.dateRange}
          fromIso={filters.fromIso}
          toIso={filters.toIso}
          onOutletIdChange={filters.setOutletId}
          onDateRangeChange={filters.setDateRange}
          onLoadingChange={handleLoadingChange}
        />
      ) : (
        <DashboardComparisonPanel
          key="comparison"
          compareOutletIds={filters.compareOutletIds}
          dateRange={filters.dateRange}
          fromIso={filters.fromIso}
          toIso={filters.toIso}
          onCompareOutletIdsChange={filters.setCompareOutletIds}
          onDateRangeChange={filters.setDateRange}
          onLoadingChange={handleLoadingChange}
        />
      )}
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </OperationsDashboardShell>
  );
}
