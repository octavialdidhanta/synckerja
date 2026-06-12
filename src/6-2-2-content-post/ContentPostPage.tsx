import { useCallback, useMemo, useState } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { useKolDeferredShowContent } from "@/6-2-1-dashboard/kol-management/hooks/useKolDeferredShowContent";
import { KolManagementContentPostPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementContentPostPageSkeleton";
import { ContentPostFilters, type ContentPostFiltersType } from "./section/ContentPostFilters";
import { ContentPostMetricsCards } from "./components/ContentPostMetricsCards";
import { ContentPostOverview } from "./components/ContentPostOverview";
import { ContentPostTable } from "./components/ContentPostTable";
import { ContentPostSidebarFooter } from "./section/ContentPostSidebarFooter";
import { useContentPostData } from "./hooks/useContentPostData";
import AddContentPostModal from "./modals/AddContentPostModal";
import { useQueryClient } from "@tanstack/react-query";
import { useKOLCampaigns } from "@/6-2-1-dashboard/kol-management/hooks/useKOLCampaigns";
import { AlertTriangle } from "lucide-react";

const defaultFilters: ContentPostFiltersType = {
  search: "",
  campaign: "all",
  platform: "all",
  status: "all",
  contentType: "all",
};

const ContentPostPage = () => {
  const queryClient = useQueryClient();
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const {
    contentPosts,
    assignments,
    milestonesByPost,
    metricsByPostId,
    conversionByPostId,
    isLoading,
    isPending: dataPending,
    createContentPostWithPayment,
    isCreating,
    updateContentPost,
    deleteContentPost,
  } = useContentPostData();

  const queriesPending = Boolean(organizationId) && dataPending;
  const rawPending = orgLoading || queriesPending;
  const showContent = useKolDeferredShowContent(rawPending);
  const [filters, setFilters] = useState<ContentPostFiltersType>(defaultFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { campaigns } = useKOLCampaigns();

  const campaignsWithHeadroom = useMemo(
    () =>
      campaigns.filter((c) => Number(c.remaining_budget ?? c.total_budget ?? c.budget ?? 0) > 0),
    [campaigns],
  );
  const budgetExhaustedCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          Number(c.total_budget ?? c.budget ?? 0) > 0 &&
          Number(c.remaining_budget ?? 0) <= 0,
      ),
    [campaigns],
  );
  const canCreatePost = campaignsWithHeadroom.length > 0 || campaigns.length === 0;

  const campaignOptions = useMemo(
    () =>
      assignments.map((item: any) => ({
        id: item.id,
        name: item.campaign?.name || "-",
        kolName: item.kol_profile?.name || "-",
      })),
    [assignments],
  );

  const filteredPosts = useMemo(() => {
    return contentPosts.filter((post: any) => {
      if (filters.search) {
        const text = `${post.title || ""} ${post.caption || ""} ${post.kol_profile?.name || ""} ${post.campaign?.name || ""}`.toLowerCase();
        if (!text.includes(filters.search.toLowerCase())) return false;
      }
      if (filters.campaign !== "all" && post.campaign_assignment_id !== filters.campaign) return false;
      if (filters.platform !== "all" && String(post.platform || "").toLowerCase() !== filters.platform.toLowerCase()) return false;
      if (filters.status !== "all" && String(post.status || "").toLowerCase() !== filters.status.toLowerCase()) return false;
      if (filters.contentType !== "all" && String(post.content_type || "").toLowerCase() !== filters.contentType.toLowerCase()) return false;
      return true;
    });
  }, [contentPosts, filters]);

  const totalMilestoneAmount = useMemo(
    () =>
      filteredPosts.reduce((acc: number, post: any) => {
        const milestones = milestonesByPost[post.id] || [];
        return acc + milestones.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      }, 0),
    [filteredPosts, milestonesByPost],
  );

  const postedPosts = useMemo(() => filteredPosts.filter((post) => post.status === "posted").length, [filteredPosts]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["kol-content-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["kol-content-performance"] }),
      queryClient.invalidateQueries({ queryKey: ["kol-content-conversions"] }),
      queryClient.invalidateQueries({ queryKey: ["kol-content-milestones"] }),
    ]);
  }, [queryClient]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch transition-opacity duration-200 ease-out",
          showContent ? "relative z-0 opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!showContent}
      >
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col">
            {budgetExhaustedCampaigns.length > 0 && (
              <div className="mb-2 flex-shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Campaign budget habis</p>
                    <p className="text-xs text-amber-800">
                      {budgetExhaustedCampaigns.map((c) => c.name).join(", ")} — tidak bisa membuat
                      content post baru sampai budget ditambah.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-2 flex-shrink-0">
              <div className="rounded-md border border-brand-blue/20 bg-white p-2 shadow-sm shadow-brand-blue/5">
                <ContentPostFilters
                  filters={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearFilters={() => setFilters(defaultFilters)}
                  onCreatePost={() => setIsCreateOpen(true)}
                  campaignOptions={campaignOptions}
                  createDisabled={!canCreatePost}
                />
              </div>
            </div>

            <div className="mb-2 flex-shrink-0">
              <ContentPostMetricsCards posts={filteredPosts} totalMilestoneAmount={totalMilestoneAmount} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm shadow-brand-blue/5 [@media(max-height:900px)]:min-h-[400px] [@media(max-height:760px)]:min-h-[440px]">
                <ContentPostTable
                  contentPosts={filteredPosts}
                  milestonesByPost={milestonesByPost}
                  metricsByPostId={metricsByPostId}
                  conversionByPostId={conversionByPostId}
                  isLoading={isLoading && showContent}
                  onRefreshData={refreshData}
                  onDelete={deleteContentPost}
                  onUpdatePost={async (id, payload) => {
                    await updateContentPost({ id, payload });
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 flex min-h-[400px] min-w-0 flex-col xl:col-span-3">
          <div className="flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm shadow-brand-blue/5">
            <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue-soft/80 px-4 py-1.5">
              <h3 className="text-sm font-semibold text-brand-blue-deep">Content Performance Dashboard</h3>
              <p className="mt-1 text-xs text-brand-blue/80">Ringkasan conversion dan performa content post.</p>
            </div>
            <div className="seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
              <ContentPostOverview posts={filteredPosts} conversionByPostId={conversionByPostId} />
            </div>
            <ContentPostSidebarFooter totalPosts={filteredPosts.length} postedPosts={postedPosts} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain absolute inset-0 z-20 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 transition-opacity duration-200 ease-out [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          showContent ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={showContent}
      >
        <KolManagementContentPostPageSkeleton variant="embedded" />
      </div>

      <AddContentPostModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        assignments={assignments}
        isLoading={isCreating}
        onSubmit={createContentPostWithPayment}
      />
    </div>
  );
};

export default ContentPostPage;
