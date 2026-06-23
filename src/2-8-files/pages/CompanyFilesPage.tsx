import { useState } from "react";
import { CompanyModuleShell } from "@/2-8-dashboard/layout/CompanyModuleShell";
import {
  COMPANY_MAIN_COLUMN,
  COMPANY_MAIN_GRID,
  COMPANY_SIDEBAR_COLUMN,
  COMPANY_TABLE_SECTION,
} from "@/2-8-dashboard/layout/companyModuleLayout";
import { CompanyFilesFilters } from "@/2-8-files/components/filters/CompanyFilesFilters";
import { CompanyFilesMetricsCards } from "@/2-8-files/components/metrics/CompanyFilesMetricsCards";
import { CompanyFilesTable } from "@/2-8-files/components/table/CompanyFilesTable";
import { CompanyFilesOverview } from "@/2-8-files/components/overview/CompanyFilesOverview";
import { CompanyFilesOverviewFooter } from "@/2-8-files/components/overview/CompanyFilesOverviewFooter";
import { FileUploadModal } from "@/2-8-files/components/modals/files/FileUploadModal";
import { CompanyFilesPageSkeleton } from "@/2-8-dashboard/skeletons/CompanyPageSkeletons";
import { useCompanyFiles } from "@/2-8-files/hooks/useCompanyFiles";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export const CompanyFilesPage = () => {
  const { t } = useAppTranslation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { loading: userDataLoading } = useCentralizedUserData();
  const { organizationId, loading: orgProfileLoading } = useCurrentOrg();
  const { user, loading: authUserLoading } = useCurrentUser();
  const { files, isLoading: filesLoading } = useCompanyFiles();

  const rawLoading =
    userDataLoading ||
    orgProfileLoading ||
    authUserLoading ||
    !organizationId ||
    !user ||
    filesLoading;
  const showContentReady = useDebouncedReady(!rawLoading, 220);
  const showShellSkeleton = !showContentReady;
  const loadingAria = t("company.page.loadingAria", "Loading company");

  const handleUploadFile = () => {
    setUploadModalOpen(true);
  };

  const lastUpdated = files.length > 0 ? files[0].created_at : undefined;

  return (
    <>
      <CompanyModuleShell>
        <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
          {showShellSkeleton ? (
            <div
              className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-gray-100"
              aria-busy="true"
              aria-label={loadingAria}
            >
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <CompanyFilesPageSkeleton className="min-h-0 flex-1" />
              </div>
            </div>
          ) : null}
          <div
            className={cn(
              "flex min-h-0 min-w-0 w-full flex-1 flex-col",
              showShellSkeleton && "pointer-events-none invisible"
            )}
          >
            <div className={COMPANY_MAIN_GRID}>
              <div className={COMPANY_MAIN_COLUMN}>
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <div className="mb-2 flex-shrink-0">
                    <div className="rounded-md border border-border bg-card p-2">
                      <CompanyFilesFilters onUploadFile={handleUploadFile} />
                    </div>
                  </div>

                  <div className="mb-2 flex-shrink-0">
                    <CompanyFilesMetricsCards />
                  </div>

                  <div className={COMPANY_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <CompanyFilesTable onUploadFile={handleUploadFile} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={COMPANY_SIDEBAR_COLUMN}>
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Files Overview</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Recent uploads and file statistics
                        </p>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <CompanyFilesOverview />
                      </div>
                    </div>

                    <CompanyFilesOverviewFooter
                      lastUpdated={lastUpdated}
                      totalFiles={files.length}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CompanyModuleShell>

      <FileUploadModal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} />
    </>
  );
};

export default CompanyFilesPage;
