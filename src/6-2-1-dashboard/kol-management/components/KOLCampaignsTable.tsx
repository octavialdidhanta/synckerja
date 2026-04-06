import { memo, useState, useMemo, useCallback } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { LoadingDots } from "@/shared/components/LoadingDots";
import { useKOLCampaigns } from "../hooks/useKOLCampaigns";
import { useCampaignPerformanceMetrics } from "../hooks/useCampaignPerformanceMetrics";
import { KOLCampaignsTableFooter } from "../section/KOLCampaignsTableFooter";
import { KOLCampaignsTableRow } from "../section/KOLCampaignsTableRow";
import AssignKOLModal from "../modals/AssignKOLModal";
import CampaignDetailsModal from "../modals/CampaignDetailsModal";
import EditCampaignModal from "../modals/EditCampaignModal";
import "./KOLCampaignsTable.css";

interface KOLCampaignsTableProps {
  campaigns?: any[];
  isLoading?: boolean;
  selectedStatus?: string;
}

export const KOLCampaignsTable = memo(
  ({
    campaigns: propCampaigns,
    isLoading: propIsLoading,
    selectedStatus,
  }: KOLCampaignsTableProps = {}) => {
    const {
      campaigns: hookCampaigns,
      isLoading: hookIsLoading,
      deleteCampaign,
    } = useKOLCampaigns();
    const { getCampaignMetrics } = useCampaignPerformanceMetrics();

    const [assignModalCampaign, setAssignModalCampaign] = useState<any | null>(null);
    const [detailsModalCampaign, setDetailsModalCampaign] = useState<any | null>(null);
    const [editModalCampaign, setEditModalCampaign] = useState<any | null>(null);

    const campaigns = propCampaigns || hookCampaigns || [];
    const isLoading = propIsLoading !== undefined ? propIsLoading : hookIsLoading;

    const getStatusColor = useCallback((status: string) => {
      switch (status) {
        case "active":
          return "bg-green-100 text-green-800 border-green-200";
        case "completed":
          return "border-brand-blue/25 bg-brand-blue/10 text-brand-blue-deep";
        case "cancelled":
          return "bg-red-100 text-red-800 border-red-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    }, []);

    const getUpdatedCampaignStatus = useCallback(
      (campaign: any) => {
        const metrics = getCampaignMetrics(campaign.id);
        if (
          campaign.status === "draft" &&
          metrics &&
          metrics.publishedPosts > 0
        ) {
          return "active";
        }
        return campaign.status || "draft";
      },
      [getCampaignMetrics],
    );

    const calculateROI = useCallback((campaign: any) => {
      if (!campaign.total_budget || !campaign.allocated_budget) return "N/A";
      const roi =
        ((campaign.allocated_budget - campaign.total_budget) /
          campaign.total_budget) *
        100;
      return `${roi.toFixed(1)}%`;
    }, []);

    const calculatePerformance = useCallback(
      (campaignId: string) => {
        const metrics = getCampaignMetrics(campaignId);
        if (!metrics) return 0;
        const avgProgress =
          (metrics.reachProgress +
            metrics.engagementProgress +
            metrics.conversionProgress) /
          3;
        return Math.round(avgProgress);
      },
      [getCampaignMetrics],
    );

    const formatCurrency = useCallback((amount: number) => {
      return `Rp ${amount.toLocaleString("id-ID")}`;
    }, []);

    const handleViewDetails = useCallback(
      (campaign: any) => {
        setDetailsModalCampaign(campaign);
      },
      [],
    );

    const handleEditCampaign = useCallback(
      (campaign: any) => {
        setEditModalCampaign(campaign);
      },
      [],
    );

    const handleAssignCampaign = useCallback(
      (campaign: any) => {
        setAssignModalCampaign(campaign);
      },
      [],
    );

    const handleDeleteCampaign = useCallback(
      (campaign: any) => {
        if (
          window.confirm(
            `Are you sure you want to delete campaign "${campaign.name}"?`,
          )
        ) {
          deleteCampaign.mutate(campaign.id);
        }
      },
      [deleteCampaign],
    );

    const tableHeaders = useMemo(
      () => [
        { key: "name", label: "Campaign Name", width: "w-48" },
        { key: "posts", label: "Posts", width: "w-32" },
        { key: "status", label: "Status", width: "w-32" },
        { key: "budget", label: "Budget", width: "w-40" },
        { key: "total_budget", label: "Total Budget", width: "w-40" },
        { key: "allocated_budget", label: "Allocated Budget", width: "w-40" },
        { key: "remaining_budget", label: "Remaining Budget", width: "w-40" },
        { key: "roi", label: "ROI", width: "w-32" },
        { key: "target_reach", label: "Target Reach", width: "w-48" },
        { key: "target_engagement", label: "Target Engagement", width: "w-48" },
        { key: "target_conversion", label: "Target Conversion", width: "w-48" },
        { key: "performance", label: "Performance", width: "w-48" },
        { key: "start_date", label: "Start Date", width: "w-36" },
        { key: "end_date", label: "End Date", width: "w-36" },
        { key: "actions", label: "Actions", width: "w-20" },
      ],
      [],
    );

    const activeCampaigns = useMemo(
      () =>
        campaigns.filter(
          (c: any) => getUpdatedCampaignStatus(c) === "active",
        ).length,
      [campaigns, getUpdatedCampaignStatus],
    );

    const renderCampaignRows = useMemo(
      () =>
        campaigns.map((campaign: any) => {
          const metrics = getCampaignMetrics(campaign.id);
          return (
            <KOLCampaignsTableRow
              key={campaign.id}
              campaign={campaign}
              metrics={metrics}
              onViewDetails={handleViewDetails}
              onEdit={handleEditCampaign}
              onAssign={handleAssignCampaign}
              onDelete={handleDeleteCampaign}
              getStatusColor={getStatusColor}
              getUpdatedCampaignStatus={getUpdatedCampaignStatus}
              calculateROI={calculateROI}
              calculatePerformance={calculatePerformance}
              formatCurrency={formatCurrency}
            />
          );
        }),
      [
        campaigns,
        getCampaignMetrics,
        handleViewDetails,
        handleEditCampaign,
        handleAssignCampaign,
        handleDeleteCampaign,
        getStatusColor,
        getUpdatedCampaignStatus,
        calculateROI,
        calculatePerformance,
        formatCurrency,
      ],
    );

    return (
      <>
        <div className="flex h-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="kol-campaigns-table w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-20 bg-brand-blue-soft shadow-sm shadow-brand-blue/10">
                <TableRow className="hover:bg-transparent">
                  {tableHeaders.map((header) => (
                    <TableHead
                      key={header.key}
                      className={`bg-brand-blue-soft px-3 text-xs font-medium text-brand-blue-deep ${header.width} whitespace-nowrap`}
                    >
                      {header.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="py-12 text-center">
                      <div className="flex items-center justify-center">
                        <LoadingDots size="lg" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={15}
                      className="py-8 text-center text-sm text-brand-blue/75"
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div>No campaigns found</div>
                        <div className="text-xs text-brand-blue/60">
                          Try adjusting your filters or search terms
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  renderCampaignRows
                )}
              </TableBody>
            </table>
          </div>
          <KOLCampaignsTableFooter
            totalCampaigns={campaigns.length}
            activeCampaigns={activeCampaigns}
            filteredCampaigns={campaigns.length}
            selectedStatus={selectedStatus}
          />
        </div>

        {assignModalCampaign && (
          <AssignKOLModal
            open={!!assignModalCampaign}
            onOpenChange={(open) => !open && setAssignModalCampaign(null)}
            campaign={assignModalCampaign}
          />
        )}

        {detailsModalCampaign && (
          <CampaignDetailsModal
            open={!!detailsModalCampaign}
            onOpenChange={(open) => !open && setDetailsModalCampaign(null)}
            campaign={detailsModalCampaign}
          />
        )}

        {editModalCampaign && (
          <EditCampaignModal
            open={!!editModalCampaign}
            onOpenChange={(open) => !open && setEditModalCampaign(null)}
            campaign={editModalCampaign}
          />
        )}
      </>
    );
  },
);

KOLCampaignsTable.displayName = "KOLCampaignsTable";

