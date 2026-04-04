import { memo, useCallback } from "react";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Star,
  Target,
  MoreHorizontal,
  Eye,
  Edit,
  DollarSign,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { KOLProfileWithStats } from "../hooks/useKOLManagementData";

interface KOLManagementTableRowProps {
  profile: KOLProfileWithStats;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onViewRatings: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  hasRating: (id: string) => boolean;
  getPerformanceRating: (id: string) => string;
  formatNumber: (num: number) => string;
  activePosts?: number;
}

export const KOLManagementTableRow = memo(
  ({
    profile,
    onViewDetails,
    onEdit,
    onViewRatings,
    onDelete,
    hasRating,
    getPerformanceRating,
    formatNumber,
    activePosts = 0,
  }: KOLManagementTableRowProps) => {
    const getStatusColor = useCallback((status: string) => {
      switch (status?.toLowerCase()) {
        case "active":
          return "bg-green-100 text-green-800 border-green-200";
        case "inactive":
          return "bg-gray-100 text-gray-800 border-gray-200";
        case "blacklisted":
          return "bg-red-100 text-red-800 border-red-200";
        default:
          return "bg-blue-100 text-blue-800 border-blue-200";
      }
    }, []);

    const handleViewDetails = useCallback(() => {
      onViewDetails(profile.id);
    }, [profile.id, onViewDetails]);

    const handleEdit = useCallback(() => {
      onEdit(profile.id);
    }, [profile.id, onEdit]);

    const handleViewRatings = useCallback(() => {
      onViewRatings(profile.id, profile.name);
    }, [profile.id, profile.name, onViewRatings]);

    const handleDelete = useCallback(() => {
      onDelete(profile.id);
    }, [profile.id, onDelete]);

    const avgEngagement =
      profile.social_accounts.length > 0
        ? (
            profile.social_accounts.reduce(
              (sum, acc) => sum + (acc.engagement_rate || 0),
              0,
            ) / profile.social_accounts.length
          ).toFixed(1)
        : profile.engagement_rate?.toFixed(1) || "0";

    return (
      <TableRow className="hover:bg-gray-50">
        <TableCell className="w-64 px-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.profile_photo_url} />
              <AvatarFallback>
                {profile.name?.charAt(0).toUpperCase() || "K"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-gray-900">{profile.name}</div>
              <div className="text-xs text-gray-500">
                {profile.age ? `${profile.age} tahun` : "N/A"} {profile.gender || ""}
              </div>
            </div>
          </div>
        </TableCell>

        <TableCell className="w-48 px-3">
          <div className="space-y-0.5">
            <div className="text-sm text-gray-900">{profile.email || "No email"}</div>
            <div className="text-xs text-gray-500">{profile.phone || "No phone"}</div>
          </div>
        </TableCell>

        <TableCell className="w-40 px-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-gray-100 p-1.5">
              <Target className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <span className="text-sm text-gray-700">{profile.category || "N/A"}</span>
          </div>
        </TableCell>

        <TableCell className="w-48 px-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-gray-900">
              {formatNumber(profile.total_reach || 0)} followers
            </div>
            <div className="text-xs text-gray-600">{avgEngagement}% engagement</div>
            <div className="text-xs text-gray-500">
              {profile.social_accounts.length > 0
                ? profile.social_accounts
                    .map((acc) => acc.platform)
                    .slice(0, 2)
                    .join(", ")
                : "No platforms"}
            </div>
          </div>
        </TableCell>

        <TableCell className="w-40 px-3">
          <div className="text-sm text-gray-900">IDR 500K - 2M</div>
          <div className="text-xs text-gray-500">per post</div>
        </TableCell>

        <TableCell className="w-32 px-3">
          {hasRating(profile.id) ? (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-current text-yellow-500" />
              <span className="text-sm font-semibold text-gray-900">
                {getPerformanceRating(profile.id)}/5
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-gray-300" />
              <span className="text-sm text-gray-500">Not Rated</span>
            </div>
          )}
        </TableCell>

        <TableCell className="w-32 px-3">
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">{activePosts}</div>
            <div className="text-xs text-gray-500">posts</div>
          </div>
        </TableCell>

        <TableCell className="w-36 px-3">
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              {profile.active_campaigns || 0}
            </div>
            <div className="text-xs text-gray-500">active</div>
          </div>
        </TableCell>

        <TableCell className="w-40 px-3">
          <Badge className={`border text-xs ${getStatusColor(profile.status || "active")}`}>
            {profile.status || "active"}
          </Badge>
        </TableCell>

        <TableCell className="w-20 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border shadow-lg">
              <DropdownMenuItem onClick={handleViewDetails}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleViewRatings}>
                <DollarSign className="mr-2 h-4 w-4" />
                Ratings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  },
);

KOLManagementTableRow.displayName = "KOLManagementTableRow";

