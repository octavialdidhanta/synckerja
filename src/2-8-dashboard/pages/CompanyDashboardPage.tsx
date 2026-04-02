import { CompanyModuleShell } from "../layout/CompanyModuleShell";
import { CompanyProfileDashboard } from "./CompanyProfileDashboard";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCompanyProfile } from "../hooks/useCompanyProfile";
import { useDebouncedShowSkeleton } from "../hooks/useDebouncedShowSkeleton";
import { CompanyDashboardPageSkeleton } from "../skeletons/CompanyPageSkeletons";
import { cn } from "@/shared/lib/utils";

export const CompanyDashboardPage = () => {
  const { organizationId } = useCurrentOrg();
  const { isLoading: profileLoading } = useCompanyProfile();
  const pending = !organizationId || profileLoading;
  const showSkeleton = useDebouncedShowSkeleton(pending);

  return (
    <CompanyModuleShell>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {showSkeleton && (
          <div
            className="absolute inset-0 z-20 flex min-h-0 flex-col bg-background/95 backdrop-blur-[1px]"
            aria-hidden
          >
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <CompanyDashboardPageSkeleton />
            </div>
          </div>
        )}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showSkeleton && 'pointer-events-none invisible'
          )}
        >
          <div
            className={cn(
              'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2',
              '[grid-template-rows:minmax(0,1fr)] items-stretch',
              '[@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none',
              '[@media(max-height:760px)]:min-h-[700px]'
            )}
          >
            <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
              <div className="min-h-full rounded-lg border border-border bg-card p-4 shadow-sm">
                <CompanyProfileDashboard />
              </div>
            </div>
          </div>
          <div
            className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
            aria-hidden
          />
        </div>
      </div>
    </CompanyModuleShell>
  );
};

export default CompanyDashboardPage;
