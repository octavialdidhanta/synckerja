import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import type { YearQuarterSelection } from "@/1-home/components/HomeOKRDashboard/component/FiturTimePeriod";
import {
  filterCyclesByYearQuarter,
  getDefaultYearQuarterSelection,
  hasYearQuarterSelection,
} from "@/1-home/components/HomeOKRDashboard/component/yearQuarterFilter";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useObjectiveStats } from "@/1-home/components/HomeOKRDashboard/hooks/useObjectiveStats";
import { useOkrCycles } from "@/shared/hooks/useOkrCycles";
import { OKRSectionVisibilityProvider } from "@/1-home/components/HomeOKRDashboard/OKRSectionVisibilityContext";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useCurrentEmployee } from "@/shared/hooks/useCurrentEmployee";
import { DeferredMount } from "@/shared/components/DeferredMount";
import { CompanyObjectivePageSkeleton } from "./components/CompanyObjectivePageSkeleton";
import { DepartmentObjectivePageSkeleton } from "./components/DepartmentObjectivePageSkeleton";
import { IndividualObjectivePageSkeleton } from "./components/IndividualObjectivePageSkeleton";
import { useOkrHeaderTabChange } from "./hooks/useOkrHeaderTabChange";
import { useOkrPageSkeletonGate } from "./hooks/useOkrPageSkeletonGate";
import { getOkrActiveTabFromPath } from "./utils/okrPaths";
import { OkrPageDetailLoadProvider, useOkrPageDetailTabs } from "./context/OkrPageDetailLoadContext";
import { HeaderAndTab, OKRSidebarFooter } from "./section";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";

const CompanyObjectivesProgressCard = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/CompanyObjectivesProgressCard").then((m) => ({
    default: m.CompanyObjectivesProgressCard,
  })),
);
const DepartmentObjectivesProgressCard = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/DepartmentObjectivesProgressCard").then((m) => ({
    default: m.DepartmentObjectivesProgressCard,
  })),
);
const IndividualObjectivesProgressCard = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/IndividualObjectivesProgressCard").then((m) => ({
    default: m.IndividualObjectivesProgressCard,
  })),
);

const CompanyObjectivesDetailView = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/CompanyObjectivesDetailView").then(
    (m) => ({ default: m.CompanyObjectivesDetailView }),
  ),
);
const DepartmentObjectivesView = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/DepartmentObjectivesView").then(
    (m) => ({ default: m.DepartmentObjectivesView }),
  ),
);
const IndividualObjectivesView = lazy(() =>
  import("@/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/IndividualObjectivesView").then(
    (m) => ({ default: m.IndividualObjectivesView }),
  ),
);

const OKRSidebar = lazy(() =>
  import("./section/OKRSidebar").then((m) => ({ default: m.OKRSidebar })),
);

const progressCardFallback = <Skeleton className="h-24 w-full rounded-lg" />;
const detailListFallback = (
  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" aria-hidden>
    <Skeleton className="h-14 w-full shrink-0 rounded-lg" />
    <Skeleton className="min-h-[8rem] w-full flex-1 rounded-lg" />
    <Skeleton className="h-28 w-full shrink-0 rounded-lg" />
  </div>
);

function OkrSidebarPlaceholder() {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-20 w-full rounded-md" />
    </div>
  );
}

function OKRPageContent() {
  const { t } = useTranslation();
  const location = useLocation();
  const handleTabChange = useOkrHeaderTabChange();
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const hasPageAccess = canAccessPage(location.pathname);
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { data: currentEmployee, isPending: currentEmployeePending } = useCurrentEmployee();
  const { data: cycles = [], isPending: cyclesPending } = useOkrCycles(organizationId);
  const detailTabs = useOkrPageDetailTabs();

  const activeTab = useMemo(
    () => getOkrActiveTabFromPath(location.pathname),
    [location.pathname],
  );

  const isCompanyTab = activeTab === "company-objectives";
  const isDepartmentTab = activeTab === "department-objectives";
  const isIndividualTab = activeTab === "individual-objectives";

  const [yearQuarterSelection, setYearQuarterSelection] = useState<YearQuarterSelection>(() =>
    getDefaultYearQuarterSelection(),
  );

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
    !cyclesPending && cycles.length > 0 ? getFilteredCycleIds(yearQuarterSelection) : undefined;
  const cycleIdsForStats =
    filteredCycleIds && filteredCycleIds.length > 0
      ? filteredCycleIds
      : cycles.length > 0
        ? cycles.map((c) => c.id)
        : undefined;
  const statsEnabled = !!organizationId && !cyclesPending;

  const companyStats = useObjectiveStats(
    organizationId,
    "company",
    cycleIdsForStats,
    statsEnabled && isCompanyTab,
  );
  const departmentStats = useObjectiveStats(
    organizationId,
    "department",
    cycleIdsForStats,
    statsEnabled && isDepartmentTab,
  );
  const individualStats = useObjectiveStats(
    organizationId,
    "individual",
    cycleIdsForStats,
    statsEnabled && isIndividualTab,
  );

  const rawPageLoadPending = useMemo(() => {
    if (accessDecisionPending || !hasPageAccess) return false;
    if (orgBootstrapPending) return true;
    if (!organizationId) return false;
    if (cyclesPending) return true;

    if (isCompanyTab) {
      return companyStats.isPending || detailTabs.company.loading;
    }
    if (isDepartmentTab) {
      return (
        departmentStats.isPending ||
        detailTabs.department.loading ||
        (currentEmployeePending && currentEmployee === undefined)
      );
    }
    return individualStats.isPending || detailTabs.individual.loading;
  }, [
    accessDecisionPending,
    hasPageAccess,
    orgBootstrapPending,
    organizationId,
    cyclesPending,
    isCompanyTab,
    isDepartmentTab,
    companyStats.isPending,
    departmentStats.isPending,
    individualStats.isPending,
    currentEmployee,
    currentEmployeePending,
    detailTabs.company.loading,
    detailTabs.department.loading,
    detailTabs.individual.loading,
    currentEmployeePending,
  ]);

  const showLoadOverlay = useOkrPageSkeletonGate(rawPageLoadPending);

  const PageSkeleton =
    isCompanyTab
      ? CompanyObjectivePageSkeleton
      : isDepartmentTab
        ? DepartmentObjectivePageSkeleton
        : IndividualObjectivePageSkeleton;

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
                <ModuleShellContentGate pagePath={location.pathname}>
                  <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
                      <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col border border-border">
                        <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
                          {isCompanyTab ? (
                            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                              <div className="shrink-0">
                                <Suspense fallback={progressCardFallback}>
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
                                </Suspense>
                              </div>
                              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {organizationId ? (
                                  <Suspense fallback={detailListFallback}>
                                    <CompanyObjectivesDetailView
                                      organizationId={organizationId}
                                      yearQuarterSelection={yearQuarterSelection}
                                      onYearQuarterChange={setYearQuarterSelection}
                                      okrStandaloneUi
                                    />
                                  </Suspense>
                                ) : null}
                              </div>
                            </div>
                          ) : isDepartmentTab ? (
                            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                              <div className="shrink-0">
                                <Suspense fallback={progressCardFallback}>
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
                                </Suspense>
                              </div>
                              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {organizationId ? (
                                  <Suspense fallback={detailListFallback}>
                                    <DepartmentObjectivesView
                                      organizationId={organizationId}
                                      cycleId={activeCycleId}
                                      cycleIds={filteredCycleIds ?? []}
                                    />
                                  </Suspense>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                              <div className="shrink-0">
                                <Suspense fallback={progressCardFallback}>
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
                                </Suspense>
                              </div>
                              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {organizationId ? (
                                  <Suspense fallback={detailListFallback}>
                                    <IndividualObjectivesView
                                      organizationId={organizationId}
                                      cycleId={activeCycleId}
                                      cycleIds={filteredCycleIds ?? []}
                                    />
                                  </Suspense>
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
                            <h3 className="text-sm font-semibold text-foreground">
                              {t("layout.okr.sidebar.title")}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("layout.okr.sidebar.subtitle")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1">
                        <div className="h-full min-h-0 p-4">
                          <DeferredMount fallback={<OkrSidebarPlaceholder />} idleTimeoutMs={800} delayMs={120}>
                            <Suspense fallback={<OkrSidebarPlaceholder />}>
                              <OKRSidebar
                                activeTab={activeTab}
                                organizationId={organizationId ?? undefined}
                                companyStats={companyStats.data}
                                departmentStats={departmentStats.data}
                                individualStats={individualStats.data}
                                cycleIds={filteredCycleIds ?? []}
                              />
                            </Suspense>
                          </DeferredMount>
                        </div>
                      </div>

                      <OKRSidebarFooter totalCycles={cycles.length} activeCycleId={activeCycleId} />
                    </div>
                  </div>
                </ModuleShellContentGate>
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
    <OkrPageDetailLoadProvider>
      <OKRSectionVisibilityProvider>
        <OKRPageContent />
      </OKRSectionVisibilityProvider>
    </OkrPageDetailLoadProvider>
  );
}

export default OKRPage;
