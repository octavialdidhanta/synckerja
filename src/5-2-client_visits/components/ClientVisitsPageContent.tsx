import React, { useState } from 'react';

import { ClientVisitsFilters } from './ClientVisitsFilters';

import { ClientVisitsMetricsCards } from './ClientVisitsMetricsCards';

import { ClientVisitsTable } from './ClientVisitsTable';

import { RecentClientVisitsOverview } from './RecentClientVisitsOverview';

import { ClientVisitsSidebarFooter } from './ClientVisitsSidebarFooter';

import { useClientVisits } from '@/shared/hooks/organized/sales';

import { Button } from '@/shared/components/ui/button';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';

import { useToast } from '@/shared/hooks/use-toast';

import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

import type { ClientVisitEditPayload } from './ClientVisitEditDialog';
import {
  SALES_OPS_MAIN_COLUMN,
  SALES_OPS_MAIN_GRID,
  SALES_OPS_SIDEBAR_COLUMN,
  SALES_OPS_TABLE_SECTION,
} from '@/5-2-activities/layout/salesOperationsLayout';

export const ClientVisitsPageContent = () => {

  const { t } = useAppTranslation();

  const { toast } = useToast();

  const { visits, refetch, error, isError, updateClientVisit, cancelClientVisit } = useClientVisits();

  const [filters, setFilters] = useState({

    search: '',

    employee: '',

    date: 'all',

    status: 'all',

  });



  const handleUpdateVisit = async (visitId: string, payload: ClientVisitEditPayload) => {

    try {

      await updateClientVisit(visitId, payload);

      await refetch();

      toast({

        title: t('clientVisits.edit.successTitle', 'Visit updated'),

        description: t('clientVisits.edit.successDescription', 'Changes saved successfully.'),

      });

    } catch (err) {

      toast({

        title: t('clientVisits.edit.errorTitle', 'Update failed'),

        description: err instanceof Error ? err.message : t('mobileHome.error', 'Error'),

        variant: 'destructive',

      });

      throw err;

    }

  };



  const handleCancelVisit = async (visitId: string) => {

    try {

      await cancelClientVisit(visitId);

      await refetch();

      toast({

        title: t('clientVisits.cancel.successTitle', 'Visit cancelled'),

        description: t('clientVisits.cancel.successDescription', 'The visit has been marked as cancelled.'),

      });

    } catch (err) {

      toast({

        title: t('clientVisits.cancel.errorTitle', 'Cancel failed'),

        description: err instanceof Error ? err.message : t('mobileHome.error', 'Error'),

        variant: 'destructive',

      });

      throw err;

    }

  };



  const filteredVisits = visits.filter((visit) => {

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

          if (visitDate.getMonth() !== today.getMonth() || visitDate.getFullYear() !== today.getFullYear()) {

            return false;

          }

          break;

        case 'last_month': {

          const lastMonth = new Date(today);

          lastMonth.setMonth(today.getMonth() - 1);

          if (

            visitDate.getMonth() !== lastMonth.getMonth() ||

            visitDate.getFullYear() !== lastMonth.getFullYear()

          ) {

            return false;

          }

          break;

        }

      }

    }

    return true;

  });



  const uniqueStatuses = [...new Set(filteredVisits.map((v) => v.status).filter(Boolean))];



  return (
    <>
      <div className={SALES_OPS_MAIN_GRID}>
        <div className={`${SALES_OPS_MAIN_COLUMN} flex flex-col gap-2`}>
          <div className="rounded-md border bg-white p-2">
            <ClientVisitsFilters filters={filters} onFiltersChange={setFilters} />
          </div>

          <ClientVisitsMetricsCards visits={filteredVisits} />

          {isError && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {error instanceof Error ? error.message : 'Failed to load client visits.'}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className={SALES_OPS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ClientVisitsTable
                visits={filteredVisits}
                selectedStatus={filters.status}
                onUpdateVisit={handleUpdateVisit}
                onCancelVisit={handleCancelVisit}
              />
            </div>
          </div>
        </div>

        <div className={SALES_OPS_SIDEBAR_COLUMN}>
          <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex-shrink-0 border-b px-4 py-1.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Client Visits Overview</h3>
                <p className="mt-1 text-xs text-gray-500">Summary of client visits</p>
              </div>
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4">
              <RecentClientVisitsOverview visits={filteredVisits} />
            </div>

            <ClientVisitsSidebarFooter
              totalStatuses={uniqueStatuses.length}
              totalVisits={filteredVisits.length}
            />
          </div>
        </div>
      </div>
    </>
  );

};


