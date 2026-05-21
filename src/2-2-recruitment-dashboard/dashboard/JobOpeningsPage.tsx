import { useState, useCallback, useMemo } from 'react';
import {
  HeaderAndTab,
  JobOpeningsFilters,
  JobOpeningsMetricsCards,
  JobOpeningsTable,
  JobOpeningsOverview
} from './components';
import { JobOpeningsSidebarFooter } from './components/JobOpeningsSidebarFooter';
import { useJobOpeningsCrud } from '@/2-2-recruitment-dashboard/job-openings/hooks/useJobOpeningsCrud';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';
import { filterJobOpenings, type JobOpeningsFilters as FilterType } from './utils/jobOpeningsUtils';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import { JobOpeningModal, GenerateLinkModal } from '@/2-2-recruitment-dashboard/job-openings';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { cn } from '@/shared/lib/utils';
import { JobOpeningsPageSkeleton } from '@/2-2-recruitment-dashboard/components/RecruitmentSkeletons';

export const JobOpeningsPage = () => {
  const [activeTab, setActiveTab] = useState('job-openings');
  const [filters, setFilters] = useState<FilterType>({
    search: '',
    status: 'all',
    department: 'all',
    position: 'all',
    level: 'all',
    timePeriod: 'all'
  });
  const [generateLinkModalOpen, setGenerateLinkModalOpen] = useState(false);
  const [selectedJobForLink, setSelectedJobForLink] = useState<JobOpening | null>(null);
  
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const {
    data: jobOpenings = [],
    isPending: jobOpeningsPending,
    refetch,
    modalOpen,
    editItem,
    openAddModal,
    openEditModal,
    closeModal,
    saveItem,
    deleteItem,
    saving,
  } = useJobOpeningsCrud();

  const showFullPageSkeleton = orgBootstrapPending || jobOpeningsPending;

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleAddJob = useCallback(() => {
    openAddModal();
  }, [openAddModal]);

  const handleEditJob = useCallback((job: JobOpening) => {
    openEditModal(job);
  }, [openEditModal]);

  const handleDeleteJob = useCallback((id: string) => {
    deleteItem(id);
  }, [deleteItem]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleGenerateLink = useCallback((job: JobOpening) => {
    setSelectedJobForLink(job);
    setGenerateLinkModalOpen(true);
  }, []);

  const handleCloseGenerateLinkModal = useCallback(() => {
    setGenerateLinkModalOpen(false);
    setSelectedJobForLink(null);
    // Refresh job openings data after closing modal
    refetch();
  }, [refetch]);

  // Filter job openings based on current filters
  const filteredJobOpenings = useMemo(() => {
    return filterJobOpenings(jobOpenings, filters);
  }, [jobOpenings, filters]);

  // Get unique departments, positions, and levels for filter options
  const departments = useMemo(() => {
    return [...new Set(jobOpenings.map(job => job.departments?.name).filter(Boolean))].sort() as string[];
  }, [jobOpenings]);

  const positions = useMemo(() => {
    return [...new Set(jobOpenings.map(job => job.job_positions?.name).filter(Boolean))].sort() as string[];
  }, [jobOpenings]);

  const levels = useMemo(() => {
    return [...new Set(jobOpenings.map(job => job.job_levels?.name).filter(Boolean))].sort() as string[];
  }, [jobOpenings]);

  const handleFilterChange = useCallback((key: keyof FilterType, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      department: 'all',
      position: 'all',
      level: 'all',
      timePeriod: 'all'
    });
  }, []);

  return (
    <>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col px-4 pb-2',
            showFullPageSkeleton && 'pointer-events-none invisible',
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                </div>

                {/* Grid Layout: 12 columns (9-3) */}
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                {/* Main Content - 9 columns */}
                <div className="col-span-9 flex min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">
                    {/* Filter Section */}
                    <div className="flex-shrink-0 mb-2">
                      <div className="bg-white border rounded-md p-2">
                        <JobOpeningsFilters 
                          filters={filters}
                          departments={departments}
                          positions={positions}
                          levels={levels}
                          onFilterChange={handleFilterChange}
                          onClearFilters={handleClearFilters}
                        />
                      </div>
                    </div>
                    
                    {/* Metrics Cards Section */}
                    <div className="flex-shrink-0 mb-2">
                      <JobOpeningsMetricsCards jobOpenings={jobOpenings} />
                    </div>
                    
                    {/* Table Section - Main Content */}
                    <div className="flex-1 min-h-0">
                      <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col seamless-scroll">
                        <JobOpeningsTable 
                          jobOpenings={filteredJobOpenings}
                          onRefresh={handleRefresh}
                          onEditJob={handleEditJob}
                          onDeleteJob={handleDeleteJob}
                          onGenerateLink={handleGenerateLink}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column - Overview Sidebar (25% like employee page) */}
                <div className="col-span-3 flex min-h-0 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
                      {/* Sidebar Header */}
                      <div className="px-4 py-1.5 border-b flex-shrink-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900">Job Openings Overview</h3>
                            <p className="text-xs text-gray-500 mt-1">Summary of job openings data</p>
                          </div>
                          <Button
                            onClick={handleAddJob}
                            className="h-8 flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap bg-brand-blue px-3 text-xs text-white hover:bg-brand-blue/90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Job
                          </Button>
                        </div>
                      </div>

                      {/* Sidebar Content */}
                      <div className="flex-1 min-h-0">
                        <div className="h-full min-h-0 p-4">
                          <JobOpeningsOverview jobOpenings={filteredJobOpenings} />
                        </div>
                      </div>

                      {/* Sidebar Footer */}
                      <JobOpeningsSidebarFooter 
                        totalDepartments={[...new Set(jobOpenings.map(job => job.departments?.name).filter(Boolean))].length}
                        selectedDepartment={filters.department || 'all'}
                        totalJobs={filteredJobOpenings.length}
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

        {showFullPageSkeleton ? (
          <div className="absolute inset-0 z-10 min-h-0 overflow-hidden">
            <JobOpeningsPageSkeleton />
          </div>
        ) : null}
      </div>

      <JobOpeningModal
        open={modalOpen}
        onClose={closeModal}
        onSave={saveItem}
        editData={editItem && editItem.isEdit ? editItem : null}
        saving={saving}
      />

      <GenerateLinkModal
        open={generateLinkModalOpen}
        onClose={handleCloseGenerateLinkModal}
        job={selectedJobForLink}
      />
    </>
  );
};

export default JobOpeningsPage;
