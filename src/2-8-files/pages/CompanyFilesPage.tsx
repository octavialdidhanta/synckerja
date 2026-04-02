import { useState } from "react";
import { CompanyModuleShell } from "@/2-8-dashboard/layout/CompanyModuleShell";
import { CompanyFilesFilters } from "@/2-8-files/components/filters/CompanyFilesFilters";
import { CompanyFilesMetricsCards } from "@/2-8-files/components/metrics/CompanyFilesMetricsCards";
import { CompanyFilesTable } from "@/2-8-files/components/table/CompanyFilesTable";
import { CompanyFilesOverview } from "@/2-8-files/components/overview/CompanyFilesOverview";
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
  const { isLoading: filesLoading } = useCompanyFiles();

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
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
              <div className="col-span-9 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
                <div className="mb-2 shrink-0">
                  <div className="rounded-md border border-border bg-card p-2">
                    <CompanyFilesFilters onUploadFile={handleUploadFile} />
                  </div>
                </div>

                <div className="mb-2 shrink-0">
                  <CompanyFilesMetricsCards />
                </div>

                <div className="min-h-0 flex-1">
                  <div className="flex h-full min-h-0 flex-col seamless-scroll rounded-lg border border-border bg-card shadow-sm">
                    <CompanyFilesTable onUploadFile={handleUploadFile} />
                  </div>
                </div>
              </div>

              <div className="col-span-3 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
                  <div className="shrink-0 border-b border-border px-4 py-1.5">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-semibold text-foreground">Files Overview</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Recent uploads and file statistics</p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <CompanyFilesOverview />
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
