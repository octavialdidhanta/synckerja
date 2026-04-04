import { Calendar, DollarSign, Target, Users, User } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import type { KOLCampaign } from "../hooks/useKOLCampaigns";

interface CampaignDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: KOLCampaign | null;
}

const CampaignDetailsModal = ({
  open,
  onOpenChange,
  campaign,
}: CampaignDetailsModalProps) => {
  if (!campaign) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "draft":
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{campaign.name}</span>
            <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Campaign Name</p>
                <p className="mt-1 text-sm text-gray-900">{campaign.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="mt-1 text-sm text-gray-600">
                  {campaign.description || "No description provided"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Objectives</p>
                <p className="mt-1 text-sm text-gray-600">
                  {campaign.objectives || "No objectives specified"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </p>
                <p className="mt-1 text-sm text-gray-900">
                  {campaign.start_date
                    ? format(new Date(campaign.start_date), "PPP")
                    : "Not specified"}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4" />
                  End Date
                </p>
                <p className="mt-1 text-sm text-gray-900">
                  {campaign.end_date
                    ? format(new Date(campaign.end_date), "PPP")
                    : "Not specified"}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4" />
                  Created By
                </p>
                <p className="mt-1 text-sm text-gray-900">
                  {campaign.creator_name || "Unknown"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900">
              <DollarSign className="h-5 w-5" />
              Budget Information
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-gray-700">Campaign Budget</p>
                <p className="mt-1 text-xl font-semibold text-blue-600">
                  {campaign.budget
                    ? `$${campaign.budget.toLocaleString()}`
                    : "Not specified"}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-sm font-medium text-gray-700">Total Budget</p>
                <p className="mt-1 text-xl font-semibold text-green-600">
                  {campaign.total_budget
                    ? `$${campaign.total_budget.toLocaleString()}`
                    : "Not specified"}
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 p-4">
                <p className="text-sm font-medium text-gray-700">Allocated Budget</p>
                <p className="mt-1 text-xl font-semibold text-purple-600">
                  {campaign.allocated_budget
                    ? `$${campaign.allocated_budget.toLocaleString()}`
                    : "Not specified"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900">
              <Target className="h-5 w-5" />
              Target Metrics
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-orange-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Users className="h-4 w-4" />
                  Target Reach
                </p>
                <p className="mt-1 text-xl font-semibold text-orange-600">
                  {campaign.target_reach
                    ? campaign.target_reach.toLocaleString()
                    : "Not specified"}
                </p>
              </div>
              <div className="rounded-lg bg-pink-50 p-4">
                <p className="text-sm font-medium text-gray-700">Target Engagement</p>
                <p className="mt-1 text-xl font-semibold text-pink-600">
                  {campaign.target_engagement
                    ? `${campaign.target_engagement}%`
                    : "Not specified"}
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-4">
                <p className="text-sm font-medium text-gray-700">Target Conversion</p>
                <p className="mt-1 text-xl font-semibold text-indigo-600">
                  {campaign.target_conversion
                    ? campaign.target_conversion.toLocaleString()
                    : "Not specified"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>
                Created: {format(new Date(campaign.created_at), "PPp")}
              </span>
              <span>
                Updated: {format(new Date(campaign.updated_at), "PPp")}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDetailsModal;

