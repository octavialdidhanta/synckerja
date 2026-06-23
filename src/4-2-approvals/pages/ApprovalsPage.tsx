import { useState, useCallback, useMemo } from 'react';
import {
  ApprovalFilters,
  ApprovalMetricsCards,
  ApprovalTable,
  ApprovalTableFooter,
  ApprovalOverview,
  ApprovalSidebarFooter,
  type ApprovalFiltersType,
} from '../section';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterRequests } from '../utils/approvalUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { ApprovalsModuleShell } from '../layout/ApprovalsModuleShell';
import { APPROVALS_MAIN_GRID, APPROVALS_TABLE_CARD } from '../layout/approvalsLayout';

export const ApprovalsPage = () => {
  const [activeTab, setActiveTab] = useState('approvals');
  const [filters, setFilters] = useState<ApprovalFiltersType>({
    search: '',
    status: 'all',
    type: 'all',
    department: 'all',
  });

  const { data: requests = [], isLoading, isPending, refetch } = usePurchaseRequests();
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const dataPending = Boolean(organizationId) && (isPending || isLoading);
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad, 280);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredRequests = useMemo(() => {
    return filterRequests(requests, filters);
  }, [requests, filters]);

  const handleFilterChange = useCallback((key: keyof ApprovalFiltersType, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      type: 'all',
      department: 'all',
    });
  }, []);

  const totalAmount = useMemo(() => {
    return filteredRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  }, [filteredRequests]);

  return (
    <ApprovalsModuleShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showContent={showContent}
    >
      <div className={APPROVALS_MAIN_GRID}>
        <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
          <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
            <div className="shrink-0 rounded-md border border-border bg-card p-2">
              <ApprovalFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <ApprovalMetricsCards requests={requests} />
            </div>

            <div className={APPROVALS_TABLE_CARD}>
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
    </ApprovalsModuleShell>
  );
};

export default ApprovalsPage;
