import { useState, useCallback, useMemo } from 'react';
import {
  HeaderAndTab,
  EmployeeFilters,
  EmployeeMetricsCards,
  EmployeeTable,
  EmployeeOverview
} from './section';
import { EmployeeSidebarFooter } from './section/EmployeeSidebarFooter';
import { useEmployees } from './hooks/useEmployees';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useCurrentOrg } from '@/1-home/components/HomeOKRDashboard/hooks/useCurrentOrg';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import { filterEmployees, type EmployeeFilters as FilterType } from './utils/employeeUtils';
import { cn } from '@/shared/lib/utils';
import { EmployeesPageSkeleton } from './components/EmployeesPageSkeleton';

export const EmployeePage = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [filters, setFilters] = useState<FilterType>({
    search: '',
    department: 'all',
    position: 'all',
    status: 'active',
    employmentType: 'all',
    timePeriod: 'all'
  });
  
  const { loading: orgLoading } = useCurrentOrg();
  const { data: employees = [], isPending: employeesPending, refetch } = useEmployees();
  const { user } = useCurrentUser();
  const { userRole } = useCentralizedUserData();
  const navigate = useNavigate();

  const showFullPageSkeleton = orgLoading || employeesPending;

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleViewEmployee = useCallback((employeeId: string) => {
    navigate(`/my-info/personal?id=${employeeId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleAddEmployee = useCallback(() => {
    navigate('/employees/add');
  }, [navigate]);

  // Filter employees based on current filters
  const filteredEmployees = useMemo(() => {
    return filterEmployees(employees, filters);
  }, [employees, filters]);

  // Get unique departments and positions for filter options
  const departments = useMemo(() => {
    return [...new Set(employees.map(emp => emp.department_name).filter(Boolean))].sort() as string[];
  }, [employees]);

  const positions = useMemo(() => {
    return [...new Set(employees.map(emp => emp.job_position_name).filter(Boolean))].sort() as string[];
  }, [employees]);

  const handleFilterChange = useCallback((key: keyof FilterType, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      department: 'all',
      position: 'all',
      status: 'active',
      employmentType: 'all',
      timePeriod: 'all'
    });
  }, []);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 w-full flex-1',
          showFullPageSkeleton && 'pointer-events-none invisible',
        )}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="mb-2 flex-shrink-0">
                        <div className="rounded-md border border-border bg-card p-2">
                          <EmployeeFilters
                            filters={filters}
                            departments={departments}
                            positions={positions}
                            onFilterChange={handleFilterChange}
                            onClearFilters={handleClearFilters}
                          />
                        </div>
                      </div>

                      <div className="mb-2 flex-shrink-0">
                        <EmployeeMetricsCards employees={employees} />
                      </div>

                      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                        <div className="flex h-full min-w-0 min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          <EmployeeTable
                            employees={filteredEmployees}
                            allEmployees={employees}
                            currentUserEmail={user?.email}
                            userRole={userRole ?? undefined}
                            onRefresh={handleRefresh}
                            onViewEmployee={handleViewEmployee}
                            isLoading={employeesPending}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          {/* Sidebar Header */}
                          <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-foreground">Employee Overview</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Summary of employee data</p>
                              </div>
                              <Button
                                onClick={handleAddEmployee}
                                className="h-8 flex-shrink-0 gap-1.5 whitespace-nowrap bg-brand-blue px-3 text-xs text-white hover:bg-brand-blue/90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Employee
                              </Button>
                            </div>
                          </div>

                          {/* Sidebar Content */}
                          <div className="flex-1 min-h-0 overflow-hidden">
                            <div className="h-full min-h-0 overflow-hidden p-4">
                              <EmployeeOverview employees={filteredEmployees} />
                            </div>
                          </div>

                          {/* Sidebar Footer */}
                          <EmployeeSidebarFooter 
                            totalDepartments={[...new Set(employees.map(emp => emp.department_name).filter(Boolean))].length}
                            selectedDepartment={filters.department || 'all'}
                            totalEmployees={filteredEmployees.length}
                          />
                        </div>
                      </div>
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

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 overflow-hidden">
          <EmployeesPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default EmployeePage;

