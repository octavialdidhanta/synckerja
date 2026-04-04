import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AttendanceStatusProvider,
  useAttendanceStatus,
} from "@/1-home/components/HomeOKRDashboard/component/AttendanceStatusProvider";
import { CompanyObjectivesProgressCard } from "@/1-home/components/HomeOKRDashboard/component/CompanyObjectivesProgressCard";
import { DepartmentObjectivesProgressCard } from "@/1-home/components/HomeOKRDashboard/component/DepartmentObjectivesProgressCard";
import { IndividualObjectivesProgressCard } from "@/1-home/components/HomeOKRDashboard/component/IndividualObjectivesProgressCard";
import type { YearQuarterSelection } from "@/1-home/components/HomeOKRDashboard/component/FiturTimePeriod";
import { CompanyObjectivesDetailView } from "@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/CompanyObjectivesDetailView";
import { DepartmentObjectivesView } from "@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/DepartmentObjectivesView";
import { IndividualObjectivesView } from "@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/IndividualObjectivesView";
import {
  filterCyclesByYearQuarter,
  getDefaultYearQuarterSelection,
  hasYearQuarterSelection,
} from "@/1-home/components/HomeOKRDashboard/component/yearQuarterFilter";
import { useCurrentOrg } from "@/1-home/components/HomeOKRDashboard/hooks/useCurrentOrg";
import { useObjectiveStats } from "@/1-home/components/HomeOKRDashboard/hooks/useObjectiveStats";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";
import { OKRSectionVisibilityProvider } from "@/1-home/components/HomeOKRDashboard/OKRSectionVisibilityContext";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import { useCurrentEmployee } from "@/shared/hooks/useCurrentEmployee";
import { CompanyObjectivePageSkeleton } from "./components/CompanyObjectivePageSkeleton";
import { DepartmentObjectivePageSkeleton } from "./components/DepartmentObjectivePageSkeleton";
import { IndividualObjectivePageSkeleton } from "./components/IndividualObjectivePageSkeleton";
import { useOkrPageSkeletonGate } from "./hooks/useOkrPageSkeletonGate";
import { getOkrActiveTabFromPath } from "./utils/okrPaths";
import { OkrPageDetailLoadProvider, useOkrPageDetailTabs } from "./context/OkrPageDetailLoadContext";
import { HeaderAndTab, OKRSidebar, OKRSidebarFooter } from "./section";

function OKRPageContent() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data: currentEmployee, isPending: currentEmployeePending } = useCurrentEmployee();
  const { data: cycles = [], isLoading: isLoadingCycles } = useOkrCycles(organizationId);
  const { isLoading: attendanceLoading } = useAttendanceStatus();
  const detailTabs = useOkrPageDetailTabs();

  const activeTab = useMemo(
    () => getOkrActiveTabFromPath(location.pathname),
    [location.pathname],
  );

  const [yearQuarterSelection, setYearQuarterSelection] = useState<YearQuarterSelection>(() =>
    getDefaultYearQuarterSelection(),
  );
  const [sidebarQueriesLoading, setSidebarQueriesLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      setSidebarQueriesLoading(false);
    }
  }, [organizationId]);

  const availableYears =
    cycles.length > 0
      ? [...new Set(cycles.map((c) => c.year))].sort((a, b) => b - a)
      : undefined;

  const getActiveCycleId = () => {
    if (!cycles.length) return undefined;
    const activeCycle = cycles.find((cycle) => cycle.is_active);
    if (activeCycle) return activeCycle.id;
    return cycles[0]?.id;
  };

  const activeCycleId = getActiveCycleId();

  const getFilteredCycleIds = (sel: YearQuarterSelection) => {
    return hasYearQuarterSelection(sel) ? filterCyclesByYearQuarter(cycles, sel) : undefined;
  };
  const filteredCycleIds =
    !isLoadingCycles && cycles.length > 0 ? getFilteredCycleIds(yearQuarterSelection) : undefined;
  const cycleIdsForStats =
    filteredCycleIds && filteredCycleIds.length > 0
      ? filteredCycleIds
      : cycles.length > 0
        ? cycles.map((c) => c.id)
        : undefined;
  const statsEnabled = !!organizationId && !isLoadingCycles;

  const companyStats = useObjectiveStats(organizationId, "company", cycleIdsForStats, statsEnabled);
  const departmentStats = useObjectiveStats(
    organizationId,
    "department",
    cycleIdsForStats,
    statsEnabled,
  );
  const individualStats = useObjectiveStats(
    organizationId,
    "individual",
    cycleIdsForStats,
    statsEnabled,
  );

  const rawPageLoadPending = useMemo(() => {
    if (orgLoading) return true;
    if (!organizationId) return false;
    if (isLoadingCycles || attendanceLoading) return true;

    if (activeTab === "company-objectives") {
      return (
        companyStats.isLoading ||
        detailTabs.company.loading ||
        sidebarQueriesLoading
      );
    }
    if (activeTab === "department-objectives") {
      return (
        departmentStats.isLoading ||
        detailTabs.department.loading ||
        sidebarQueriesLoading ||
        currentEmployeePending
      );
    }
    return (
      individualStats.isLoading ||
      detailTabs.individual.loading ||
      sidebarQueriesLoading
    );
  }, [
    orgLoading,
    organizationId,
    isLoadingCycles,
    attendanceLoading,
    activeTab,
    companyStats.isLoading,
    departmentStats.isLoading,
    individualStats.isLoading,
    detailTabs.company.loading,
    detailTabs.department.loading,
    detailTabs.individual.loading,
    sidebarQueriesLoading,
    currentEmployeePending,
  ]);

  const showLoadOverlay = useOkrPageSkeletonGate(rawPageLoadPending);

  const PageSkeleton =
    activeTab === "company-objectives"
      ? CompanyObjectivePageSkeleton
      : activeTab === "department-objectives"
        ? DepartmentObjectivePageSkeleton
        : IndividualObjectivePageSkeleton;

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === "department-objectives") {
        navigate("/okr/department-objective");
      } else if (tab === "individual-objectives") {
        navigate("/okr/individual-objective");
      } else {
        navigate("/okr/company-objective");
      }
    },
    [navigate],
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans dark:bg-muted/30">
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1",
          showLoadOverlay && "invisible pointer-events-none",
        )}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0">
                <HeaderAndTab onTabChange={handleTabChange} />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
                  <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col border border-border">
                    <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
                      {activeTab === "company-objectives" ? (
                        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                          <div className="shrink-0">
                            <CompanyObjectivesProgressCard
                              enhancedCompanyObjectives={[]}
                              calculateOverallProgress={() => companyStats.data?.avgProgress || 0}
                              activeObjectives={[]}
                              draftObjectives={[]}
                              completedObjectives={[]}
                              loading={false}
                              error={companyStats.error?.message || null}
                              stats={companyStats.data}
                              organizationId={organizationId}
                              yearQuarterSelection={yearQuarterSelection}
                              onYearQuarterChange={setYearQuarterSelection}
                              availableYears={availableYears}
                              isLoadingCycles={false}
                            />
                          </div>
                          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col basis-0">
                            {organizationId ? (
                              <CompanyObjectivesDetailView
                                organizationId={organizationId}
                                yearQuarterSelection={yearQuarterSelection}
                                onYearQuarterChange={setYearQuarterSelection}
                                okrStandaloneUi
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : activeTab === "department-objectives" ? (
                        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                          <div className="shrink-0">
                            <DepartmentObjectivesProgressCard
                              enhancedDepartmentObjectives={[]}
                              calculateOverallProgress={() => departmentStats.data?.avgProgress || 0}
                              activeObjectives={[]}
                              draftObjectives={[]}
                              completedObjectives={[]}
                              loading={false}
                              error={departmentStats.error?.message || null}
                              organizationId={organizationId}
                              cycleId={activeCycleId}
                              departmentId={currentEmployee?.departments?.id || undefined}
                              yearQuarterSelection={yearQuarterSelection}
                              onYearQuarterChange={setYearQuarterSelection}
                              availableYears={availableYears}
                              isLoadingCycles={false}
                            />
                          </div>
                          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col basis-0">
                            {organizationId ? (
                              <DepartmentObjectivesView
                                organizationId={organizationId}
                                cycleId={activeCycleId}
                                cycleIds={filteredCycleIds ?? []}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                          <div className="shrink-0">
                            <IndividualObjectivesProgressCard
                              enhancedIndividualObjectives={[]}
                              calculateOverallProgress={() => individualStats.data?.avgProgress || 0}
                              activeObjectives={[]}
                              draftObjectives={[]}
                              completedObjectives={[]}
                              loading={false}
                              error={individualStats.error?.message || null}
                              organizationId={organizationId}
                              cycleId={activeCycleId}
                              yearQuarterSelection={yearQuarterSelection}
                              onYearQuarterChange={setYearQuarterSelection}
                              availableYears={availableYears}
                              isLoadingCycles={false}
                            />
                          </div>
                          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col basis-0">
                            {organizationId ? (
                              <IndividualObjectivesView
                                organizationId={organizationId}
                                cycleId={activeCycleId}
                                cycleIds={filteredCycleIds ?? []}
                              />
                            ) : null}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="col-span-3 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{t("layout.okr.sidebar.title")}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{t("layout.okr.sidebar.subtitle")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1">
                    <div className="h-full min-h-0 p-4">
                      <OKRSidebar
                        activeTab={activeTab}
                        organizationId={organizationId ?? undefined}
                        companyStats={companyStats.data}
                        departmentStats={departmentStats.data}
                        individualStats={individualStats.data}
                        cycleIds={filteredCycleIds ?? []}
                        onSidebarQueriesLoadingChange={setSidebarQueriesLoading}
                      />
                    </div>
                  </div>

                  <OKRSidebarFooter totalCycles={cycles.length} activeCycleId={activeCycleId} />
                </div>
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
                </div>
              </div>
            </div>
          </div>
      </div>

      {showLoadOverlay ? (
        <div className="absolute inset-0 z-10 overflow-auto bg-gray-100 dark:bg-muted/30">
          <PageSkeleton />
        </div>
      ) : null}
    </div>
  );
}

export function OKRPage() {
  return (
    <AttendanceStatusProvider>
      <OkrPageDetailLoadProvider>
        <OKRSectionVisibilityProvider>
          <OKRPageContent />
        </OKRSectionVisibilityProvider>
      </OkrPageDetailLoadProvider>
    </AttendanceStatusProvider>
  );
}

export default OKRPage;
