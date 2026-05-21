import { useCallback, useMemo, useState } from "react";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { cn } from "@/shared/lib/utils";
import {
  KOLCampaignsFilters,
  type KOLCampaignsFiltersType,
} from "../section/KOLCampaignsFilters";
import { KOLCampaignsMetricsCards } from "./KOLCampaignsMetricsCards";
import { KOLCampaignsOverview } from "./KOLCampaignsOverview";
import { KOLCampaignsTable } from "./KOLCampaignsTable";
import { KOLCampaignsSidebarFooter } from "../section/KOLCampaignsSidebarFooter";
import { useKOLCampaigns } from "../hooks/useKOLCampaigns";
import { useCampaignPerformanceMetrics } from "../hooks/useCampaignPerformanceMetrics";
import { useKolDeferredShowContent } from "../hooks/useKolDeferredShowContent";
import { KolManagementCampaignsPageSkeleton } from "../skeletons/KolManagementCampaignsPageSkeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CreateCampaignModal } from "../modals/CreateCampaignModal";

const KOLCampaignsPage = () => {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId } = useOrgBootstrapPending();
  const { campaigns, isLoading, isPending: campaignsPending } = useKOLCampaigns();
  const { isPending: performanceMetricsPending } = useCampaignPerformanceMetrics();

  const queriesPending =
    Boolean(organizationId) && (campaignsPending || performanceMetricsPending);
  const rawPending = orgBootstrapPending || queriesPending;
  const showContent = useKolDeferredShowContent(rawPending);

  const [filters, setFilters] = useState<KOLCampaignsFiltersType>({
    search: "",
    status: "all",
    budget: "all",
    date: "all",
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleFilterChange = useCallback(
    (key: keyof KOLCampaignsFiltersType, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "all",
      budget: "all",
      date: "all",
    });
  }, []);

  const handleNewCampaign = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns || [];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower),
      );
    }

    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter((c: any) => (c.status || "draft") === filters.status);
    }

    return filtered;
  }, [campaigns, filters]);

  const activeCampaigns = useMemo(
    () => filteredCampaigns.filter((c: any) => c.status === "active").length,
    [filteredCampaigns],
  );

  return (
    <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
      {!showContent ? (
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain absolute inset-0 z-20 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <KolManagementCampaignsPageSkeleton variant="embedded" />
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-h-[calc(100vh-120px)] min-w-0 flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch",
          !showContent && "invisible pointer-events-none",
        )}
        aria-hidden={!showContent}
      >
        {/* Main (table) */}
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex-shrink-0">
              <div className="rounded-md border border-brand-blue/20 bg-white p-2 shadow-sm shadow-brand-blue/5">
                <KOLCampaignsFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  onNewCampaign={handleNewCampaign}
                />
              </div>
            </div>
            <div className="mb-2 flex-shrink-0">
              <KOLCampaignsMetricsCards />
            </div>
            <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm shadow-brand-blue/5">
                <KOLCampaignsTable
                  campaigns={filteredCampaigns}
                  isLoading={isLoading && showContent}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="col-span-12 flex min-h-[400px] min-w-0 flex-col xl:col-span-3">
          <div className="flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm shadow-brand-blue/5">
            <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue-soft/80 px-4 py-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-brand-blue-deep">
                    {t("kolCampaigns.overview.title", "Campaign Overview")}
                  </h3>
                  <p className="mt-1 text-xs text-brand-blue/80">
                    {t("kolCampaigns.overview.description", "Summary of campaign data")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 seamless-scroll nested-scroll-touch-chain">
              <KOLCampaignsOverview
                campaigns={filteredCampaigns}
                metrics={{
                  totalCampaigns: filteredCampaigns.length,
                  activeCampaigns,
                  totalBudget: filteredCampaigns.reduce(
                    (sum, c: any) => sum + (c.total_budget || 0),
                    0,
                  ),
                  allocatedBudget: filteredCampaigns.reduce(
                    (sum, c: any) => sum + (c.allocated_budget || 0),
                    0,
                  ),
                  remainingBudget: filteredCampaigns.reduce(
                    (sum, c: any) =>
                      sum + ((c.total_budget || 0) - (c.allocated_budget || 0)),
                    0,
                  ),
                }}
              />
            </div>
            <KOLCampaignsSidebarFooter
              totalCampaigns={filteredCampaigns.length}
              activeCampaigns={activeCampaigns}
              selectedStatus={filters.status || "all"}
            />
          </div>
        </div>
      </div>

      <CreateCampaignModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
};

export default KOLCampaignsPage;

