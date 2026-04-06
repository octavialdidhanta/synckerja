import React, { useState } from 'react';
import { ClientVisitsFilters } from './ClientVisitsFilters';
import { ClientVisitsMetricsCards } from './ClientVisitsMetricsCards';
import { ClientVisitsTable } from './ClientVisitsTable';
import { RecentClientVisitsOverview } from './RecentClientVisitsOverview';
import { ClientVisitsSidebarFooter } from './ClientVisitsSidebarFooter';
import { useClientVisits } from '@/shared/hooks/organized/sales';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

/** Grid + sidebar rhythm matches `VisitSchedulingPageContent` (jadwal-kunjungan). */
export const ClientVisitsPageContent = () => {
  const { visits, refetch, error, isError } = useClientVisits();
  const [filters, setFilters] = useState({
    search: '',
    employee: '',
    date: 'all',
    status: 'all'
  });

  const handleEdit = (visit: any) => {
    console.log('Edit visit:', visit);
    refetch();
  };

  const filteredVisits = visits.filter(visit => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const clientName = visit.clientInfo?.company_name?.toLowerCase() || '';
      const locationName = visit.locationInfo?.name?.toLowerCase() || '';
      if (!clientName.includes(searchLower) && !locationName.includes(searchLower)) {
        return false;
      }
    }
    if (filters.employee && visit.employees?.id !== filters.employee) {
      return false;
    }
    if (filters.status !== 'all' && visit.status !== filters.status) {
      return false;
    }
    if (filters.date !== 'all') {
      const visitDate = new Date(visit.visit_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.date) {
        case 'today':
          if (visitDate.toDateString() !== today.toDateString()) return false;
          break;
        case 'this_week': {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          if (visitDate < weekStart) return false;
          break;
        }
        case 'this_month':
          if (visitDate.getMonth() !== today.getMonth() || visitDate.getFullYear() !== today.getFullYear()) return false;
          break;
        case 'last_month': {
          const lastMonth = new Date(today);
          lastMonth.setMonth(today.getMonth() - 1);
          if (visitDate.getMonth() !== lastMonth.getMonth() || visitDate.getFullYear() !== lastMonth.getFullYear()) return false;
          break;
        }
      }
    }
    return true;
  });

  const uniqueStatuses = [...new Set(filteredVisits.map(v => v.status).filter(Boolean))];

  return (
    <>
      <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex h-full min-h-0 min-w-0 w-full max-w-full flex-col lg:col-span-9">
          <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
            <div className="mb-2 flex-shrink-0">
              <div className="rounded-md border bg-white p-2">
                <ClientVisitsFilters filters={filters} onFiltersChange={setFilters} />
              </div>
            </div>

            <div className="mb-2 flex-shrink-0">
              <ClientVisitsMetricsCards visits={filteredVisits} />
            </div>

            {isError && (
              <div className="mb-2 flex-shrink-0">
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {error instanceof Error ? error.message : "Failed to load client visits."}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex h-full min-h-0 flex-1">
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm seamless-scroll">
                <ClientVisitsTable 
                  visits={filteredVisits}
                  onEdit={handleEdit}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 flex h-full min-h-0 min-w-0 w-full max-w-full flex-col lg:col-span-3">
          <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
            <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex-shrink-0 border-b px-4 py-1.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">Client Visits Overview</h3>
                  <p className="mt-1 text-xs text-gray-500">Summary of client visits</p>
                </div>
              </div>

              <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4">
                <RecentClientVisitsOverview visits={filteredVisits} />
              </div>

              <ClientVisitsSidebarFooter 
                totalStatuses={uniqueStatuses.length}
                totalVisits={filteredVisits.length}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
