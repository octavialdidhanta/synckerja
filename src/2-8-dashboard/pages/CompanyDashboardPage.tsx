import { CompanyModuleShell } from "../layout/CompanyModuleShell";
import { CompanyDashboardWorkspace } from "../layout/CompanyDashboardWorkspace";
import { CompanyProfileDashboard } from "./CompanyProfileDashboard";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCompanyProfile } from "../hooks/useCompanyProfile";
import { useEmployees } from "@/2-1-employees/hooks/useEmployees";
import { useDebouncedShowSkeleton } from "../hooks/useDebouncedShowSkeleton";
import { CompanyDashboardPageSkeleton } from "../skeletons/CompanyPageSkeletons";
import { cn } from "@/shared/lib/utils";

export const CompanyDashboardPage = () => {
  const { organizationId } = useCurrentOrg();
  const { isLoading: profileLoading } = useCompanyProfile();
  const { data: employees = [] } = useEmployees();
  const pending = !organizationId || profileLoading;
  const showSkeleton = useDebouncedShowSkeleton(pending);

  return (
    <CompanyModuleShell>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {showSkeleton && (
          <div
            className="absolute inset-0 z-20 flex min-h-0 flex-col bg-gray-100"
            aria-hidden
          >
            <CompanyDashboardPageSkeleton />
          </div>
        )}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            showSkeleton && "pointer-events-none invisible",
          )}
        >
          <CompanyDashboardWorkspace count={employees.length}>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
              <CompanyProfileDashboard />
            </div>
          </CompanyDashboardWorkspace>
        </div>
      </div>
    </CompanyModuleShell>
  );
};

export default CompanyDashboardPage;
