import { useState, useCallback, useMemo } from 'react';
import {
  PaymentFilters,
  PaymentMetricsCards,
  PaymentTable,
  PaymentOverview,
  PaymentSidebarFooter,
  type PaymentFiltersType,
} from '../section';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterPaymentRequests } from '../utils/paymentUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { PaymentProcessModuleShell } from '../layout/PaymentProcessModuleShell';
import { PaymentProcessWorkspace } from '../layout/PaymentProcessWorkspace';

export const PaymentProcessPage = () => {
  const [activeTab, setActiveTab] = useState('payment-process');
  const [filters, setFilters] = useState<PaymentFiltersType>({
    search: '',
    status: 'all',
    type: 'all',
    department: 'all',
    period: 'all',
  });

  const { data: requests = [], isLoading, isPending, refetch, isFetched } = usePurchaseRequests();
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  /** Tanpa `isFetching`: refetch manual/invalidasi tidak membuka skeleton penuh. */
  const dataPending = Boolean(organizationId) && (!isFetched || isLoading || isPending);
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad, 220);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredRequests = useMemo(() => {
    return filterPaymentRequests(requests, filters);
  }, [requests, filters]);

  /** Selaras perilaku lama PaymentOverview: filter kosong → tampilkan semua data untuk panel kanan. */
  const overviewRequests = useMemo(
    () => (filteredRequests.length > 0 ? filteredRequests : requests),
    [filteredRequests, requests],
  );

  const handleFilterChange = useCallback((key: keyof PaymentFiltersType, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      type: 'all',
      department: 'all',
      period: 'all',
    });
  }, []);

  const totalAmount = useMemo(() => {
    return filteredRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  }, [filteredRequests]);

  return (
    <PaymentProcessModuleShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showContent={showContent}
    >
      <PaymentProcessWorkspace
        count={filteredRequests.length}
        toolbar={
          <>
            <div className="shrink-0">
              <div className="rounded-md border border-border bg-card p-2">
                <PaymentFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                />
              </div>
            </div>

            <div className="shrink-0">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PaymentMetricsCards requests={requests} />
              </div>
            </div>
          </>
        }
        sidebar={
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="shrink-0 border-b border-border px-4 py-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Payment Overview</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Summary of payment requests</p>
                </div>
              </div>
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <PaymentOverview requests={overviewRequests} />
            </div>

            <PaymentSidebarFooter
              totalRequests={filteredRequests.length}
              totalAmount={totalAmount}
            />
          </div>
        }
      >
        <PaymentTable
          requests={filteredRequests}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />
      </PaymentProcessWorkspace>
    </PaymentProcessModuleShell>
  );
};

export default PaymentProcessPage;
