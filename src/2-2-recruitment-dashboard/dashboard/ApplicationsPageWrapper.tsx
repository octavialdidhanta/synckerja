import { useState, useCallback } from 'react';
import { useCurrentOrg } from '@/1-home/components/HomeOKRDashboard/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { useJobApplications } from '@/2-2-recruitment-dashboard/applications/hooks/useJobApplications';
import { RecruitmentApplicationsSkeleton } from '@/2-2-recruitment-dashboard/components/RecruitmentSkeletons';
import { HeaderAndTab } from './components';
import { ApplicationsPage } from '@/2-2-recruitment-dashboard/applications/dashboard/ApplicationsPage';

export const ApplicationsPageWrapper = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const { loading: orgLoading } = useCurrentOrg();
  const { isPending: applicationsPending } = useJobApplications();

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const showFullPageSkeleton = orgLoading || applicationsPending;

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
              <div className="min-h-full">
                <ApplicationsPage />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 overflow-auto">
          <RecruitmentApplicationsSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationsPageWrapper;
