import { useState, useCallback, useMemo } from 'react';
import {
  PaymentFilters,
  PaymentMetricsCards,
  PaymentTable,
  PaymentTableFooter,
  PaymentOverview,
  PaymentSidebarFooter,
  type PaymentFiltersType
} from '../section';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterPaymentRequests } from '../utils/paymentUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { PaymentProcessModuleShell } from '../layout/PaymentProcessModuleShell';

/**
 * Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`):
 * AppShell sudah punya scroll — root `h-full min-h-0 flex-1 overflow-hidden` (bukan `h-screen`).
 * HeaderAndTab di dalam satu kolom scroll utama; wrapper tanpa `max-h-[calc(100vh-120px)]`.
 */
const GRID_MAIN =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px] xl:grid-rows-1 xl:items-stretch';

const TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

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
  const dataPending =
    Boolean(organizationId) && (!isFetched || isLoading || isPending);
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad, 220);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Filter requests - only approved requests for payment processing
  const approvedRequests = useMemo(() => {
    return requests.filter(req => req.status === 'approved');
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return filterPaymentRequests(requests, filters);
  }, [requests, filters]);

  /** Selaras perilaku lama PaymentOverview: filter kosong → tampilkan semua data untuk panel kanan. */
  const overviewRequests = useMemo(
    () => (filteredRequests.length > 0 ? filteredRequests : requests),
    [filteredRequests, requests],
  );

  const handleFilterChange = useCallback((key: keyof PaymentFiltersType, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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

  // Calculate totals
  const totalAmount = useMemo(() => {
    return filteredRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  }, [filteredRequests]);

  return (
    <PaymentProcessModuleShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showContent={showContent}
    >
      <div className={GRID_MAIN}>
        <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
          <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
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

            <div className={TABLE_SECTION}>
              <PaymentTable
                requests={filteredRequests}
                onRefresh={handleRefresh}
                isLoading={isLoading}
              />
              <PaymentTableFooter
                totalRequests={approvedRequests.length}
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
                  <h3 className="text-sm font-semibold text-foreground">Payment Overview</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Summary of payment requests</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 p-4">
              <PaymentOverview requests={overviewRequests} />
            </div>

            <PaymentSidebarFooter
              totalRequests={filteredRequests.length}
              totalAmount={totalAmount}
              selectedStatus={filters.status}
            />
          </div>
        </div>
      </div>
    </PaymentProcessModuleShell>
  );
};

export default PaymentProcessPage;
