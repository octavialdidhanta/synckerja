import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { cn } from "@/shared/lib/utils";
import type { KOLManagementFiltersType } from "../section/KOLManagementFilters";
import { KOLManagementFilters } from "../section/KOLManagementFilters";
import { KOLManagementMetricsCards } from "./KOLManagementMetricsCards";
import { KOLManagementTable } from "./KOLManagementTable";
import { KOLManagementOverview } from "./KOLManagementOverview";
import { KOLManagementSidebarFooter } from "../section/KOLManagementSidebarFooter";
import { useKOLManagementData } from "../hooks/useKOLManagementData";
import { useKOLRatings } from "../hooks/useKOLRatings";
import { useKolDeferredShowContent } from "../hooks/useKolDeferredShowContent";
import { KolManagementKolManagementPageSkeleton } from "../skeletons/KolManagementKolManagementPageSkeleton";
import EnhancedAddKOLModal from "../modals/EnhancedAddKOLModal";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { KOL_PHOTO_BUCKET, kolPhotoPathFromUrl } from "../modals/AddKOLModal/kolPhotoPath";

const KOLManagementPage = () => {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId } = useOrgBootstrapPending();
  const { isPending: ratingsPending } = useKOLRatings();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filters, setFilters] = useState<KOLManagementFiltersType>({
    search: "",
    category: "all",
    platform: "all",
    status: "all",
    performance: "all",
  });

  const { filteredProfiles, metrics, isLoading, isPending: profilesPending } = useKOLManagementData(filters);

  const queriesPending =
    Boolean(organizationId) && (profilesPending || ratingsPending);
  const rawPending = orgBootstrapPending || queriesPending;
  const showContent = useKolDeferredShowContent(rawPending);

  const handleFilterChange = useCallback(
    (key: keyof KOLManagementFiltersType, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      category: "all",
      platform: "all",
      status: "all",
      performance: "all",
    });
  }, []);

  const handleAddKOL = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  /** Delete from the table menu. Social accounts, rates, ratings, contracts and payment terms go with it (FK cascade). */
  const handleDeleteKOL = useCallback(
    async (kolId: string) => {
      if (!organizationId) return;
      const photoUrl = filteredProfiles.find((p) => p.id === kolId)?.profile_photo_url ?? null;
      const { data, error } = await supabase
        .from("kol_profiles")
        .delete()
        .eq("id", kolId)
        .eq("organization_id", organizationId)
        .select("id");
      if (error || !data?.length) {
        // 23503: content posts, deliverables, conversions or performance metrics still point at this KOL.
        const blocked = error?.code === "23503";
        toast({
          title: "Error",
          description: blocked
            ? t("kolManagement.delete.blocked", "This KOL still has content posts, deliverables or performance data. Remove those first.")
            : t("kolManagement.delete.failed", "Failed to delete KOL profile"),
          variant: "destructive",
        });
        return;
      }
      const photoPath = typeof photoUrl === "string" ? kolPhotoPathFromUrl(photoUrl) : null;
      if (photoPath) await supabase.storage.from(KOL_PHOTO_BUCKET).remove([photoPath]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kol-management-data"] }),
        queryClient.invalidateQueries({ queryKey: ["kol-profiles-with-social"] }),
      ]);
      toast({ title: "Success", description: t("kolManagement.delete.success", "KOL profile deleted") });
    },
    [filteredProfiles, organizationId, queryClient, t, toast],
  );

  const categories = useMemo(() => {
    return [...new Set(filteredProfiles.map((profile) => profile.category).filter(Boolean))].length;
  }, [filteredProfiles]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {!showContent ? (
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain absolute inset-0 z-20 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <KolManagementKolManagementPageSkeleton variant="embedded" />
        </div>
      ) : null}

      {/* Grid: section utama (tabel) + sidebar kanan */}
      <div
        className={cn(
          "grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch",
          !showContent && "invisible pointer-events-none",
        )}
        aria-hidden={!showContent}
      >
        {/* Main (9 columns) */}
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex-shrink-0">
              <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
                <KOLManagementFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  onAddKOL={handleAddKOL}
                />
              </div>
            </div>

            <div className="mb-2 flex-shrink-0">
              <KOLManagementMetricsCards metrics={metrics} isLoading={isLoading && showContent} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm [@media(max-height:900px)]:min-h-[400px] [@media(max-height:760px)]:min-h-[440px]">
                <KOLManagementTable
                  profiles={filteredProfiles}
                  isLoading={isLoading && showContent}
                  selectedCategory={filters.category}
                  onDelete={handleDeleteKOL}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar (3 columns) */}
        <div className="col-span-12 flex min-h-[400px] min-w-0 flex-col xl:col-span-3">
          <div className="flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50/80 px-4 py-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {t("kolManagement.overview.title", "KOL Overview")}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(
                      "kolManagement.overview.description",
                      "Summary of KOL data",
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 seamless-scroll nested-scroll-touch-chain">
              <KOLManagementOverview metrics={metrics} profiles={filteredProfiles} />
            </div>
            <KOLManagementSidebarFooter
              totalCategories={categories}
              selectedCategory={filters.category || "all"}
              totalKOLs={filteredProfiles.length}
            />
          </div>
        </div>
      </div>

      <EnhancedAddKOLModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
    </div>
  );
};

export default KOLManagementPage;

