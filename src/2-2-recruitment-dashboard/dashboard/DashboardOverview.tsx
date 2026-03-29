import { useState, useCallback } from 'react';
import { useJobOpeningsCrud } from '@/2-2-recruitment-dashboard/job-openings/hooks/useJobOpeningsCrud';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';
import { useCurrentOrg } from '@/1-home/components/HomeOKRDashboard/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { RecruitmentDashboardSkeleton } from '@/2-2-recruitment-dashboard/components/RecruitmentSkeletons';
import { HeaderAndTab } from './components';

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
  const { loading: orgLoading } = useCurrentOrg();
  const { data: jobOpenings, isPending: jobOpeningsPending } = useJobOpeningsCrud();

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const showFullPageSkeleton = orgLoading || jobOpeningsPending;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col bg-muted/30 font-sans',
          showFullPageSkeleton && 'pointer-events-none invisible',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex-shrink-0">
              <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
            </div>
            <div className="seamless-scroll nested-scroll-touch-chain max-h-[calc(100vh-8rem)] min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="min-h-full rounded-lg border border-border bg-card p-4 shadow-sm">
                <DashboardOverviewContent jobOpenings={jobOpenings} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 overflow-auto">
          <RecruitmentDashboardSkeleton />
        </div>
      ) : null}
    </div>
  );
}

export default DashboardOverview;
