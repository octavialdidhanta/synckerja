import { useState, useCallback } from 'react';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { cn } from '@/shared/lib/utils';
import { RecruitmentIntervieweesSkeleton } from '@/2-2-recruitment-dashboard/components/RecruitmentSkeletons';
import { HeaderAndTab } from '@/2-2-recruitment-dashboard/dashboard/components';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { IntervieweeTab } from './IntervieweeTab';

export const IntervieweesPage = () => {
  const [activeTab, setActiveTab] = useState('interviewees');
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const [tabLoading, setTabLoading] = useState(true);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    orgBootstrapPending || tabLoading,
    '/recruitment/interviewees',
  );

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
                <ModuleShellContentGate>
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <IntervieweeTab onLoadingChange={setTabLoading} />
                  </div>
                </div>
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 min-h-0 overflow-hidden">
          <RecruitmentIntervieweesSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default IntervieweesPage;
