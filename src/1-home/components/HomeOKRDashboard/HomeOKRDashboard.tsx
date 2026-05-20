import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';

const SectionGreetings = lazy(() =>
  import('./component/SectionGreetings').then((m) => ({ default: m.SectionGreetings })),
);
import { SectionQuickMenu } from './component/SectionQuickMenu';

const ObjectivesTab = lazy(() =>
  import('./component/ObjectivesTab').then((m) => ({ default: m.ObjectivesTab })),
);
import { CompanyObjectivesProgressCard } from './component/CompanyObjectivesProgressCard';
import { DepartmentObjectivesProgressCard } from './component/DepartmentObjectivesProgressCard';
import { IndividualObjectivesProgressCard } from './component/IndividualObjectivesProgressCard';
import { AttendanceStatusProvider } from './component/AttendanceStatusProvider';
import { Target, Building, User } from 'lucide-react';
import type { OkrFilterState } from './types/okr-filter';
import type { YearQuarterSelection } from './component/FiturTimePeriod';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { useCurrentOrg } from './hooks/useCurrentOrg';
import { useObjectiveStats } from './hooks/useObjectiveStats';
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
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const {
    data: cycles = [],
    isLoading: isLoadingCycles
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

  // Get real stats for each objective type (lazy: company first, then department, then individual)
  const companyStats = useObjectiveStats(organizationId, 'company', getFilteredCycleIds(yearQuarterSelection), true);
  const departmentStats = useObjectiveStats(organizationId, 'department', getFilteredCycleIds(yearQuarterSelection), readyDepartmentStats);
  const individualStats = useObjectiveStats(organizationId, 'individual', getFilteredCycleIds(yearQuarterSelection), readyIndividualStats);

  const departmentStatsPending =
    readyDepartmentStats && departmentStats.isLoading;
  const individualStatsPending =
    readyIndividualStats && individualStats.isLoading;

  const { tabs, firstError: okrTabsError } = useHomeOkrTabsAggregate();

  const okrLoading =
    orgLoading || isLoadingCycles || tabs.company.loading || companyStats.isLoading;

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
  return (
    <div className="flex h-full min-h-0 flex-col space-y-2">
      <Suspense fallback={greetingFallback}>
        <div className="flex-shrink-0">
          <SectionGreetings currentTime={currentTime} greeting={getGreeting()} />
        </div>
      </Suspense>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border">
        
        <CardContent className="flex-1 flex flex-col overflow-hidden">
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
              className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <div className="space-y-4" role="region" aria-label="Objectives list">
              {/* Company Objectives Progress Overview */}
              <CompanyObjectivesProgressCard
                enhancedCompanyObjectives={[]} // Will be populated by ObjectivesTab
                calculateOverallProgress={() => companyStats.data?.avgProgress || 0}
                activeObjectives={[]} // Will be populated by ObjectivesTab
                draftObjectives={[]} // Will be populated by ObjectivesTab
                completedObjectives={[]} // Will be populated by ObjectivesTab
                loading={companyStats.isLoading}
                error={companyStats.error?.message || null}
                stats={companyStats.data}
                organizationId={organizationId}
                yearQuarterSelection={yearQuarterSelection}
                onYearQuarterChange={setYearQuarterSelection}
                availableYears={availableYears}
                isLoadingCycles={isLoadingCycles}
              />
              
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
            </TabsContent>

            <TabsContent
              value="department-objectives"
              className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <div className="space-y-4" role="region" aria-label="Objectives list">
              {/* Department Objectives Progress Overview */}
              <DepartmentObjectivesProgressCard
                enhancedDepartmentObjectives={[]} // Will be populated by ObjectivesTab
                calculateOverallProgress={() => departmentStats.data?.avgProgress || 0}
                activeObjectives={[]} // Will be populated by ObjectivesTab
                draftObjectives={[]} // Will be populated by ObjectivesTab
                completedObjectives={[]} // Will be populated by ObjectivesTab
                loading={departmentStats.isLoading}
                error={departmentStats.error?.message || null}
                organizationId={organizationId}
                cycleId={activeCycleId}
                departmentId={currentEmployee?.departments?.id || undefined}
                yearQuarterSelection={yearQuarterSelection}
                onYearQuarterChange={setYearQuarterSelection}
                availableYears={availableYears}
                isLoadingCycles={isLoadingCycles}
              />
              
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
            </TabsContent>

            <TabsContent
              value="individual-objectives"
              className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <div className="space-y-4" role="region" aria-label="Objectives list">
              {/* Individual Objectives Progress Overview */}
              <IndividualObjectivesProgressCard
                enhancedIndividualObjectives={[]} // Will be populated by ObjectivesTab
                calculateOverallProgress={() => individualStats.data?.avgProgress || 0}
                activeObjectives={[]} // Will be populated by ObjectivesTab
                draftObjectives={[]} // Will be populated by ObjectivesTab
                completedObjectives={[]} // Will be populated by ObjectivesTab
                loading={individualStats.isLoading}
                error={individualStats.error?.message || null}
                organizationId={organizationId}
                cycleId={activeCycleId}
                yearQuarterSelection={yearQuarterSelection}
                onYearQuarterChange={setYearQuarterSelection}
                availableYears={availableYears}
                isLoadingCycles={isLoadingCycles}
              />
              
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