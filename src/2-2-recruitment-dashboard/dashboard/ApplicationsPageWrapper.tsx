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
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1',
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
                    <ApplicationsPage />
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
          <RecruitmentApplicationsSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationsPageWrapper;
