import { memo, useCallback } from "react";
import {
  TableCell,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { format } from "date-fns";
import { CampaignsActionsDropdown } from "../components/CampaignsActionsDropdown";

interface KOLCampaignsTableRowProps {
  campaign: any;
  metrics: any;
  onViewDetails: (campaign: any) => void;
  onEdit: (campaign: any) => void;
  onAssign: (campaign: any) => void;
  onDelete: (campaign: any) => void;
  getStatusColor: (status: string) => string;
  getUpdatedCampaignStatus: (campaign: any) => string;
  calculateROI: (campaign: any) => string;
  calculatePerformance: (campaignId: string) => number;
  formatCurrency: (amount: number) => string;
}

export const KOLCampaignsTableRow = memo(
  ({
    campaign,
    metrics,
    onViewDetails,
    onEdit,
    onAssign,
    onDelete,
    getStatusColor,
    getUpdatedCampaignStatus,
    calculateROI,
    calculatePerformance,
    formatCurrency,
  }: KOLCampaignsTableRowProps) => {
    const handleViewDetails = useCallback(() => {
      onViewDetails(campaign);
    }, [campaign, onViewDetails]);

    const handleEdit = useCallback(() => {
      onEdit(campaign);
    }, [campaign, onEdit]);

    const handleAssign = useCallback(() => {
      onAssign(campaign);
    }, [campaign, onAssign]);

    const handleDelete = useCallback(() => {
      onDelete(campaign);
    }, [campaign, onDelete]);

    const reachProgress = metrics?.reachProgress ?? 0;
    const engagementProgress = metrics?.engagementProgress ?? 0;
    const conversionProgress = metrics?.conversionProgress ?? 0;

    const actualReach = metrics?.totalReach ?? metrics?.actualReach ?? 0;
    const actualEngagement =
      metrics?.totalEngagement ?? metrics?.actualEngagement ?? 0;
    const actualConversions =
      metrics?.totalConversions ?? metrics?.actualConversions ?? 0;

    return (
      <TableRow className="hover:bg-gray-50">
        <TableCell className="w-48 px-3">
          <div>
            <p className="text-xs font-medium text-gray-900">{campaign.name}</p>
            {campaign.description && (
              <p className="max-w-[200px] truncate text-xs text-gray-500">
                {campaign.description}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell className="w-32 px-3">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-gray-900">
              {metrics
                ? `${metrics.publishedPosts}/${metrics.totalPosts}`
                : "0/0"}
            </div>
            <div className="text-xs text-gray-500">Published/Total</div>
          </div>
        </TableCell>
        <TableCell className="w-32 px-3">
          <Badge
            className={`border text-xs ${getStatusColor(
              getUpdatedCampaignStatus(campaign),
            )}`}
          >
            {getUpdatedCampaignStatus(campaign)}
          </Badge>
        </TableCell>
        <TableCell className="w-40 px-3">
          <span className="text-xs font-medium text-gray-900">
            {campaign.budget
              ? formatCurrency(campaign.budget)
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-40 px-3">
          <span className="text-xs font-medium text-gray-900">
            {campaign.total_budget
              ? formatCurrency(campaign.total_budget)
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-40 px-3">
          <span className="text-xs text-gray-600">
            {campaign.allocated_budget
              ? formatCurrency(campaign.allocated_budget)
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-40 px-3">
          <span className="text-xs text-gray-600">
            {campaign.total_budget
              ? formatCurrency(
                  campaign.total_budget - (campaign.allocated_budget || 0),
                )
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-32 px-3">
          <span className="text-xs font-medium text-green-600">
            {calculateROI(campaign)}
          </span>
        </TableCell>
        <TableCell className="w-48 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Target:{" "}
                {campaign.target_reach
                  ? campaign.target_reach.toLocaleString()
                  : "Not set"}
              </span>
              <span className="font-medium text-gray-800">
                {reachProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={reachProgress} className="h-2" />
            <div className="text-xs text-gray-500">
              Actual: {actualReach.toLocaleString()}
            </div>
          </div>
        </TableCell>
        <TableCell className="w-48 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Target:{" "}
                {campaign.target_engagement
                  ? `${campaign.target_engagement}%`
                  : "Not set"}
              </span>
              <span className="font-medium text-gray-800">
                {engagementProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={engagementProgress} className="h-2" />
            <div className="text-xs text-gray-500">
              Actual: {actualEngagement.toFixed(2)}%
            </div>
          </div>
        </TableCell>
        <TableCell className="w-48 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Target:{" "}
                {campaign.target_conversion
                  ? campaign.target_conversion.toLocaleString()
                  : "Not set"}
              </span>
              <span className="font-medium text-gray-800">
                {conversionProgress.toFixed(0)}%
              </span>
            </div>
            <Progress value={conversionProgress} className="h-2" />
            <div className="text-xs text-gray-500">
              Actual: {actualConversions.toLocaleString()}
            </div>
          </div>
        </TableCell>
        <TableCell className="w-48 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Overall</span>
              <span className="font-medium text-gray-800">
                {calculatePerformance(campaign.id)}%
              </span>
            </div>
            <Progress value={calculatePerformance(campaign.id)} className="h-2" />
            <div className="text-xs text-gray-500">Based on metrics</div>
          </div>
        </TableCell>
        <TableCell className="w-36 px-3">
          <span className="text-xs text-gray-600">
            {campaign.start_date
              ? format(new Date(campaign.start_date), "MMM dd, yyyy")
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-36 px-3">
          <span className="text-xs text-gray-600">
            {campaign.end_date
              ? format(new Date(campaign.end_date), "MMM dd, yyyy")
              : "Not specified"}
          </span>
        </TableCell>
        <TableCell className="w-20 px-3">
          <CampaignsActionsDropdown
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            onAssign={handleAssign}
            onDelete={handleDelete}
          />
        </TableCell>
      </TableRow>
    );
  },
);

KOLCampaignsTableRow.displayName = "KOLCampaignsTableRow";

