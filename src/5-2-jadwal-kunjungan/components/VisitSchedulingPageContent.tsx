import React, { useState } from 'react';
import { VisitSchedulingFilters } from './VisitSchedulingFilters';
import { VisitSchedulingMetricsCards } from './VisitSchedulingMetricsCards';
import { VisitSchedulingTable } from './VisitSchedulingTable';
import { UpcomingVisitsOverview } from './UpcomingVisitsOverview';
import { VisitSchedulingSidebarFooter } from './VisitSchedulingSidebarFooter';
import { VisitSchedulingWizard } from './VisitSchedulingWizard';
import { useVisitScheduling } from '@/shared/hooks/organized/sales';
import { useOfficeLocations } from '@/shared/hooks/organized/sales';

export const VisitSchedulingPageContent = () => {
  const { visits, refetch } = useVisitScheduling();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    salesPerson: '',
    date: 'all',
    status: 'all'
  });
  const { addLocation } = useOfficeLocations();

  const handleScheduleVisit = async (locationData: any) => {
    console.log('Scheduling visit:', locationData);
    const result = await addLocation(locationData);
    if (result) {
      setIsModalOpen(false);
      refetch();
    }
  };

  const handleEdit = (visit: any) => {
    console.log('Edit visit:', visit);
    refetch();
  };

  const handleUpdatePayment = (visit: any) => {
    console.log('Update payment:', visit);
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
    if (filters.salesPerson && visit.employees?.id !== filters.salesPerson) {
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
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (visitDate.toDateString() !== tomorrow.toDateString()) return false;
          break;
        case 'this_week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          if (visitDate < weekStart) return false;
          break;
        case 'next_week':
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
          if (visitDate < nextWeekStart || visitDate >= nextWeekEnd) return false;
          break;
        case 'this_month':
          if (visitDate.getMonth() !== today.getMonth() || visitDate.getFullYear() !== today.getFullYear()) return false;
          break;
      }
    }
    return true;
  });

  // Calculate unique statuses for footer
  const uniqueStatuses = [...new Set(filteredVisits.map(v => v.status).filter(Boolean))];

  return (
    <>
      {/* Visit Scheduling Wizard */}
      <VisitSchedulingWizard
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleScheduleVisit}
      />

      {/* Grid Layout: 12 columns (9-3 desktop); full-width rows on small screens */}
      <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-12 gap-2">
        {/* Main Content */}
        <div className="col-span-12 h-full min-h-0 min-w-0 w-full max-w-full flex flex-col lg:col-span-9">
          <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
            {/* Filter Section */}
            <div className="flex-shrink-0 mb-2">
              <div className="bg-white border rounded-md p-2">
                <VisitSchedulingFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  onNewVisit={() => setIsModalOpen(true)}
                />
              </div>
            </div>
            
            {/* Metrics Cards Section */}
            <div className="flex-shrink-0 mb-2">
              <VisitSchedulingMetricsCards visits={filteredVisits} />
            </div>
            
            {/* Table Section - Main Content */}
            <div className="flex-1 min-h-0 h-full">
              <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col seamless-scroll">
                <VisitSchedulingTable 
                  visits={filteredVisits}
                  onRefresh={refetch}
                  onEdit={handleEdit}
                  onUpdatePayment={handleUpdatePayment}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Overview Sidebar */}
        <div className="col-span-12 h-full min-h-0 min-w-0 w-full max-w-full flex flex-col lg:col-span-3">
          <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
            <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
              {/* Sidebar Header */}
              <div className="flex-shrink-0 border-b px-4 py-1.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">Visit Scheduling Overview</h3>
                  <p className="mt-1 text-xs text-gray-500">Summary of scheduled visits</p>
                </div>
              </div>

              {/* Scrollable Sidebar Content */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4">
                <UpcomingVisitsOverview visits={filteredVisits} />
              </div>

              {/* Sidebar Footer */}
              <VisitSchedulingSidebarFooter 
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









