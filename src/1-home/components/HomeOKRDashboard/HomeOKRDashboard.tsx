import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PayrollPaidHomeBanner } from '@/1-home/components/PayrollPaidHomeBanner';

const SectionGreetings = lazy(() =>
  import('./component/SectionGreetings').then((m) => ({ default: m.SectionGreetings })),
);

const ObjectivesTab = lazy(() =>
  import('./component/ObjectivesTab').then((m) => ({ default: m.ObjectivesTab })),
);
const CompanyObjectivesProgressCard = lazy(() =>
  import('./component/CompanyObjectivesProgressCard').then((m) => ({
    default: m.CompanyObjectivesProgressCard,
  })),
);
const DepartmentObjectivesProgressCard = lazy(() =>
  import('./component/DepartmentObjectivesProgressCard').then((m) => ({
    default: m.DepartmentObjectivesProgressCard,
  })),
);
const IndividualObjectivesProgressCard = lazy(() =>
  import('./component/IndividualObjectivesProgressCard').then((m) => ({
    default: m.IndividualObjectivesProgressCard,
  })),
);

const progressCardFallback = <Skeleton className="h-24 w-full rounded-lg" />;
import { AttendanceStatusProvider } from './component/AttendanceStatusProvider';
import { Target, Building, User } from 'lucide-react';
import type { OkrFilterState } from './types/okr-filter';
import type { YearQuarterSelection } from './component/FiturTimePeriod';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useHomeOkrObjectiveStats } from './hooks/useObjectiveStats';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import {
  filterCyclesByYearQuarter,
  getDefaultYearQuarterSelection,
  hasYearQuarterSelection,
} from './component/yearQuarterFilter';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';
import {
  HomeOkrTabsLoadProvider,
  useHomeOkrTabsAggregate,
} from '@/1-home/context/HomeOkrTabsLoadContext';
const DEFAULT_OKR_TAB = 'company-objectives';

const HomeOKRDashboardContent = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'employee'>('employee');
  const [openKeyResults, setOpenKeyResults] = useState<{
    [key: number]: boolean;
  }>({});
  const [filters, setFilters] = useState<OkrFilterState>({
    conditions: [],
    logic: 'and'
  });
  const [yearQuarterSelection, setYearQuarterSelection] = useState<YearQuarterSelection>(
    () => getDefaultYearQuarterSelection(),
  );
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const {
    data: cycles = [],
    isPending: cyclesPending,
  } = useOkrCycles(organizationId);
  const {
    data: currentEmployee
  } = useCurrentEmployee();

  const [visitedOkrTabs, setVisitedOkrTabs] = useState(
    () => new Set<string>([DEFAULT_OKR_TAB]),
  );
  const markOkrTabVisited = (tab: string) => {
    setVisitedOkrTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };
  const readyDepartmentStats = visitedOkrTabs.has('department-objectives');
  const readyIndividualStats = visitedOkrTabs.has('individual-objectives');

  // Get available years from cycles
  const availableYears = cycles.length > 0 ? cycles.map(c => c.year).filter((year, index, arr) => arr.indexOf(year) === index).sort((a, b) => b - a) : undefined;

  // Get current active cycle ID (prefer active cycle, fallback to most recent)
  const getActiveCycleId = () => {
    if (!cycles.length) {
      // Return undefined instead of invalid UUID to prevent query errors
      return undefined;
    }
    
    // First try to find an active cycle
    const activeCycle = cycles.find(cycle => cycle.is_active);
    if (activeCycle) return activeCycle.id;
    
    // Fallback to most recent cycle (first in the ordered list)
    return cycles[0]?.id;
  };

  const activeCycleId = getActiveCycleId();

  // Calculate filtered cycle IDs for stats
  const getFilteredCycleIds = (yearQuarterSelection: YearQuarterSelection) => {
    return hasYearQuarterSelection(yearQuarterSelection) 
      ? filterCyclesByYearQuarter(cycles, yearQuarterSelection)
      : undefined;
  };

  const filteredCycleIds = getFilteredCycleIds(yearQuarterSelection);
  const { company: companyStats, department: departmentStats, individual: individualStats } =
    useHomeOkrObjectiveStats({
      organizationId,
      cycleIds: filteredCycleIds,
      loadCompany: true,
      loadDepartment: readyDepartmentStats,
      loadIndividual: readyIndividualStats,
    });

  const departmentStatsPending =
    readyDepartmentStats && departmentStats.isPending;
  const individualStatsPending =
    readyIndividualStats && individualStats.isPending;

  const { tabs, firstError: okrTabsError } = useHomeOkrTabsAggregate();

  const okrLoading =
    orgBootstrapPending ||
    (!!organizationId && cyclesPending) ||
    tabs.company.loading ||
    (!!organizationId && companyStats.isPending);

  const okrError =
    okrTabsError ||
    companyStats.error ||
    departmentStats.error ||
    individualStats.error ||
    null;

  useReportHomeSectionStatus('okr', okrLoading, okrError);

  const greetingFallback = (
    <div className="flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30" aria-hidden>
      <Skeleton className="h-[88px] w-full rounded-lg" />
    </div>
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { t } = useAppTranslation();
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('greeting.goodMorning', 'Good Morning');
    if (hour < 15) return t('greeting.goodAfternoon', 'Good Afternoon');
    if (hour < 18) return t('greeting.goodEvening', 'Good Evening');
    return t('greeting.goodNight', 'Good Night');
  };
  const toggleKeyResults = (index: number) => {
    setOpenKeyResults(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  const okrTabScrollClassName =
    "home-okr-tab-scroll scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden space-y-2">
      <Suspense fallback={greetingFallback}>
        <div className="flex-shrink-0">
          <SectionGreetings currentTime={currentTime} greeting={getGreeting()} />
        </div>
      </Suspense>

      <PayrollPaidHomeBanner />

      <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-border">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0">
          <Tabs
            defaultValue={DEFAULT_OKR_TAB}
            onValueChange={markOkrTabVisited}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-3 mt-4 flex-shrink-0">
              <TabsTrigger value="company-objectives" className="text-sm font-semibold">Company Objective</TabsTrigger>
              <TabsTrigger value="department-objectives" className="text-sm font-semibold">Department Objective</TabsTrigger>
              <TabsTrigger value="individual-objectives" className="text-sm font-semibold">Individual Objective</TabsTrigger>
            </TabsList>

            <TabsContent
              value="company-objectives"
              className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className={okrTabScrollClassName} role="region" aria-label="Objectives list">
              <div className="space-y-4">
              <Suspense fallback={progressCardFallback}>
                <CompanyObjectivesProgressCard
                  enhancedCompanyObjectives={[]}
                  calculateOverallProgress={() => companyStats.data?.avgProgress || 0}
                  activeObjectives={[]}
                  draftObjectives={[]}
                  completedObjectives={[]}
                  loading={companyStats.isLoading}
                  error={companyStats.error?.message || null}
                  stats={companyStats.data}
                  organizationId={organizationId}
                  yearQuarterSelection={yearQuarterSelection}
                  onYearQuarterChange={setYearQuarterSelection}
                  availableYears={availableYears}
                  isLoadingCycles={cyclesPending}
                />
              </Suspense>
              
              {visitedOkrTabs.has('company-objectives') ? (
                <Suspense fallback={<Skeleton className="min-h-[200px] w-full rounded-lg" />}>
                  <ObjectivesTab
                    type="company"
                    title={`Company Objectives ${new Date().getFullYear()}`}
                    icon={Target}
                    iconColor="text-okr-company"
                    userRole={userRole}
                    openKeyResults={openKeyResults}
                    onToggleKeyResults={toggleKeyResults}
                    stats={companyStats.data || { avgProgress: 0, totalObjectives: 0, nextDeadline: "N/A" }}
                    filters={filters}
                    onFiltersChange={setFilters}
                    yearQuarterSelection={yearQuarterSelection}
                    onYearQuarterChange={setYearQuarterSelection}
                    availableYears={availableYears}
                  />
                </Suspense>
              ) : null}
              </div>
              </div>
            </TabsContent>

            <TabsContent
              value="department-objectives"
              className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className={okrTabScrollClassName} role="region" aria-label="Objectives list">
              <div className="space-y-4">
              {visitedOkrTabs.has('department-objectives') ? (
                <Suspense fallback={progressCardFallback}>
                  <DepartmentObjectivesProgressCard
                    enhancedDepartmentObjectives={[]}
                    calculateOverallProgress={() => departmentStats.data?.avgProgress || 0}
                    activeObjectives={[]}
                    draftObjectives={[]}
                    completedObjectives={[]}
                    loading={departmentStats.isLoading}
                    error={departmentStats.error?.message || null}
                    organizationId={organizationId}
                    cycleId={activeCycleId}
                    departmentId={currentEmployee?.departments?.id || undefined}
                    yearQuarterSelection={yearQuarterSelection}
                    onYearQuarterChange={setYearQuarterSelection}
                    availableYears={availableYears}
                    isLoadingCycles={cyclesPending}
                  />
                </Suspense>
              ) : null}
              
              {visitedOkrTabs.has('department-objectives') ? (
                <Suspense fallback={<Skeleton className="min-h-[200px] w-full rounded-lg" />}>
                  <ObjectivesTab
                    type="department"
                    title="Department Objectives"
                    icon={Building}
                    iconColor="text-okr-department"
                    userRole={userRole}
                    openKeyResults={openKeyResults}
                    onToggleKeyResults={toggleKeyResults}
                    stats={departmentStats.data || { avgProgress: 0, totalObjectives: 0, nextDeadline: "N/A" }}
                    filters={filters}
                    onFiltersChange={setFilters}
                    yearQuarterSelection={yearQuarterSelection}
                    onYearQuarterChange={setYearQuarterSelection}
                    availableYears={availableYears}
                  />
                </Suspense>
              ) : null}
              </div>
              </div>
            </TabsContent>

            <TabsContent
              value="individual-objectives"
              className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className={okrTabScrollClassName} role="region" aria-label="Objectives list">
              <div className="space-y-4">
              {visitedOkrTabs.has('individual-objectives') ? (
                <Suspense fallback={progressCardFallback}>
                  <IndividualObjectivesProgressCard
                    enhancedIndividualObjectives={[]}
                    calculateOverallProgress={() => individualStats.data?.avgProgress || 0}
                    activeObjectives={[]}
                    draftObjectives={[]}
                    completedObjectives={[]}
                    loading={individualStats.isLoading}
                    error={individualStats.error?.message || null}
                    organizationId={organizationId}
                    cycleId={activeCycleId}
                    yearQuarterSelection={yearQuarterSelection}
                    onYearQuarterChange={setYearQuarterSelection}
                    availableYears={availableYears}
                    isLoadingCycles={cyclesPending}
                  />
                </Suspense>
              ) : null}

              {visitedOkrTabs.has('individual-objectives') ? (
                <Suspense fallback={<Skeleton className="min-h-[200px] w-full rounded-lg" />}>
                  <ObjectivesTab
                    type="individual"
                    title="My Individual Objectives"
                    icon={User}
                    iconColor="text-okr-individual"
                    userRole={userRole}
                    openKeyResults={openKeyResults}
                    onToggleKeyResults={toggleKeyResults}
                    stats={individualStats.data || { avgProgress: 0, totalObjectives: 0, nextDeadline: "N/A" }}
                    filters={filters}
                    onFiltersChange={setFilters}
                    yearQuarterSelection={yearQuarterSelection}
                    onYearQuarterChange={setYearQuarterSelection}
                    availableYears={availableYears}
                  />
                </Suspense>
              ) : null}
              </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
function HomeOKRDashboardInner() {
  return (
    <HomeOkrTabsLoadProvider>
      <HomeOKRDashboardContent />
    </HomeOkrTabsLoadProvider>
  );
}

export const HomeOKRDashboard = () => {
  return (
    <AttendanceStatusProvider>
      <HomeOKRDashboardInner />
    </AttendanceStatusProvider>
  );
};