import { useState, useCallback } from 'react';
import { useJobOpeningsCrud } from '@/2-2-recruitment-dashboard/job-openings/hooks/useJobOpeningsCrud';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { cn } from '@/shared/lib/utils';
import { RecruitmentDashboardSkeleton } from '@/2-2-recruitment-dashboard/components/RecruitmentSkeletons';
import { HeaderAndTab, RecruitmentDashboardFooter } from './components';

interface DashboardOverviewContentProps {
  jobOpenings: JobOpening[] | undefined;
}

function DashboardOverviewContent({ jobOpenings }: DashboardOverviewContentProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-4">
          <div className="text-2xl font-bold text-brand-blue">
            {jobOpenings?.filter(job => job.status === 'active').length || 0}
          </div>
          <div className="text-sm text-brand-blue">Active Positions</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-600">
            {jobOpenings?.filter(job => job.status === 'draft').length || 0}
          </div>
          <div className="text-sm text-yellow-600">Draft Positions</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="text-2xl font-bold text-green-600">
            {jobOpenings?.reduce((sum, job) => sum + (job.submissions || 0), 0) || 0}
          </div>
          <div className="text-sm text-green-600">Total Applications</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="text-2xl font-bold text-purple-600">
            {jobOpenings?.reduce((sum, job) => sum + (job.clicks || 0), 0) || 0}
          </div>
          <div className="text-sm text-purple-600">Total Clicks</div>
        </div>
      </div>

      {/* Top performing jobs */}
      <div className="bg-white border rounded-lg p-4">
        <h4 className="font-semibold mb-4">Top Performing Jobs</h4>
        {jobOpenings && jobOpenings.length > 0 ? (
          <div className="space-y-2">
            {jobOpenings.sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5).map(job => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{job.job_title}</p>
                  <p className="text-sm text-gray-600">
                    Created by: {job.creator_profile?.full_name || 'Unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-brand-blue">{job.clicks || 0} clicks</p>
                  <p className="text-sm text-gray-600">{job.submissions || 0} applications</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No job data available</p>
        )}
      </div>
    </div>
  );
}

export function DashboardOverview() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { data: jobOpenings, isPending: jobOpeningsPending } = useJobOpeningsCrud();

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const showFullPageSkeleton = orgBootstrapPending || jobOpeningsPending;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          showFullPageSkeleton && 'pointer-events-none invisible',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
                </div>
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <div className="flex min-h-full min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <div className="min-w-0 flex-1 p-4">
                        <DashboardOverviewContent jobOpenings={jobOpenings} />
                      </div>
                      <RecruitmentDashboardFooter jobOpenings={jobOpenings} />
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
        <div className="absolute inset-0 z-10 min-h-0 overflow-hidden">
          <RecruitmentDashboardSkeleton />
        </div>
      ) : null}
    </div>
  );
}

export default DashboardOverview;
