import { useState, useCallback, useMemo } from 'react';
import {
  HeaderAndTab,
  ApprovalFilters,
  ApprovalMetricsCards,
  ApprovalTable,
  ApprovalTableFooter,
  ApprovalOverview,
  ApprovalSidebarFooter,
  type ApprovalFiltersType
} from '../section';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterRequests } from '../utils/approvalUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { ApprovalsModuleShell } from '../layout/ApprovalsModuleShell';
import { ApprovalsPageSkeleton } from '@/4-2-approvals/skeletons/ApprovalsPageSkeleton';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useLocation } from 'react-router-dom';

/** Header ikut scroll + baseline `/expenses/debt` (Seamless Page Scroll Layout) */

const GRID_MAIN =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-rows-1 xl:items-stretch';

const TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

export const ApprovalsPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('approvals');
  const [filters, setFilters] = useState<ApprovalFiltersType>({
    search: '',
    status: 'all',
    type: 'all',
    department: 'all'
  });
  
  const { data: requests = [], isLoading, isPending, refetch } = usePurchaseRequests();
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const dataPending = Boolean(organizationId) && (isPending || isLoading);
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Filter requests based on current filters
  const filteredRequests = useMemo(() => {
    return filterRequests(requests, filters);
  }, [requests, filters]);

  const handleFilterChange = useCallback((key: keyof ApprovalFiltersType, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      type: 'all',
      department: 'all'
    });
  }, []);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return filteredRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  }, [filteredRequests]);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col min-w-0',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <ApprovalsModuleShell>
          <div className="mb-1 min-w-0 shrink-0">
            <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          <ModuleShellContentGate pagePath={location.pathname}>
          <div className={GRID_MAIN}>
            <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
              <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
                <div className="shrink-0">
                  <div className="rounded-md border border-border bg-card p-2">
                    <ApprovalFilters
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      onClearFilters={handleClearFilters}
                    />
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <ApprovalMetricsCards />
                  </div>
                </div>

                <div
                  className={cn(
                    TABLE_SECTION,
                    'rounded-lg border border-border bg-card shadow-sm',
                  )}
                >
                  <ApprovalTable
                    requests={filteredRequests}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                  />
                  <ApprovalTableFooter
                    totalRequests={requests.length}
                    filteredRequests={filteredRequests.length}
                    totalAmount={totalAmount}
                    selectedStatus={filters.status}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
              <div className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="shrink-0 border-b border-border px-4 py-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">Approval Overview</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Summary of approval requests
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 min-w-0 flex-1 p-4">
                  <ApprovalOverview requests={filteredRequests} />
                </div>

                <ApprovalSidebarFooter
                  totalRequests={filteredRequests.length}
                  totalAmount={totalAmount}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>
          </ModuleShellContentGate>
        </ApprovalsModuleShell>
      </div>
      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-auto bg-gray-100"
          aria-busy
        >
          <ApprovalsPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default ApprovalsPage;
