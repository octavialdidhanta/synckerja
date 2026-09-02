import { useState, useCallback } from 'react';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { cn } from '@/shared/lib/utils';
import { useJobApplications } from '@/2-2-recruitment-dashboard/applications/hooks/useJobApplications';
import { ApplicationsPageSkeleton } from '@/2-2-recruitment-dashboard/applications/dashboard/ApplicationsPageSkeleton';
import { HeaderAndTab } from './components';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { ApplicationsPage } from '@/2-2-recruitment-dashboard/applications/dashboard/ApplicationsPage';
import {
  RECRUITMENT_FULL_COLUMN,
  RECRUITMENT_MAIN_GRID,
} from '@/2-2-recruitment-dashboard/layout/recruitmentIntervieweesLayout';

export const ApplicationsPageWrapper = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { isPending: applicationsPending } = useJobApplications();

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    orgBootstrapPending || applicationsPending,
    '/recruitment/applications',
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
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
                </div>
                <ModuleShellContentGate>
                  <div className={RECRUITMENT_MAIN_GRID}>
                    <div className={RECRUITMENT_FULL_COLUMN}>
                      <ApplicationsPage />
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
          <ApplicationsPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationsPageWrapper;
