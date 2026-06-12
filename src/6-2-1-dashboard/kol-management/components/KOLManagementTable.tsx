import { memo, useCallback, useMemo, useState } from "react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { KOLProfileWithStats } from "../hooks/useKOLManagementData";
import { useKOLRatings } from "../hooks/useKOLRatings";
import { useKOLPostsAndMetrics } from "../hooks/useKOLPostsAndMetrics";
import { LoadingDots } from "@/shared/components/LoadingDots";
import { Users } from "lucide-react";

import { KOLManagementTableRow } from "../section/KOLManagementTableRow";
import { KOLManagementTableFooter } from "../section/KOLManagementTableFooter";

import "../styles/KOLManagementTable.css";
import KOLDetailModal from "../modals/KOLDetailModal";
import EditKOLModal from "../modals/EditKOLModal";
import { KOLRatingsModal } from "../modals/KOLRatingsModal";

interface KOLManagementTableProps {
  profiles: KOLProfileWithStats[];
  isLoading?: boolean;
  selectedCategory?: string;
  onViewDetails?: (id: string) => void;
  onEdit?: (id: string) => void;
  onViewRatings?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}

export const KOLManagementTable = memo(
  ({
    profiles = [],
    isLoading = false,
    selectedCategory,
    onViewDetails,
    onEdit,
    onViewRatings,
    onDelete,
  }: KOLManagementTableProps) => {
    const [selectedKOLId, setSelectedKOLId] = useState<string | null>(null);
    const [selectedKOLName, setSelectedKOLName] = useState<string>("");
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRatingsModalOpen, setIsRatingsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const { getKOLRatings, getAverageRating } = useKOLRatings();
    const { aggregatedMetrics } = useKOLPostsAndMetrics();

    const hasRating = useCallback(
      (kolId: string) => {
        const ratings = getKOLRatings(kolId);
        return ratings.length > 0;
      },
      [getKOLRatings],
    );

    const getPerformanceRating = useCallback(
      (kolId: string) => {
        const avg = getAverageRating(kolId);
        return avg.toFixed(1);
      },
      [getAverageRating],
    );

    const formatNumber = useCallback((num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num.toString();
    }, []);

    const handleViewDetails = useCallback(
      (kolId: string) => {
        setSelectedKOLId(kolId);
        setIsDetailModalOpen(true);
        onViewDetails?.(kolId);
      },
      [onViewDetails],
    );

    const handleViewRatings = useCallback(
      (kolId: string, kolName: string) => {
        setSelectedKOLId(kolId);
        setSelectedKOLName(kolName);
        setIsRatingsModalOpen(true);
        onViewRatings?.(kolId, kolName);
      },
      [onViewRatings],
    );

    const handleEdit = useCallback(
      (kolId: string) => {
        setSelectedKOLId(kolId);
        setIsEditModalOpen(true);
        onEdit?.(kolId);
      },
      [onEdit],
    );

    const handleDelete = useCallback(
      async (kolId: string) => {
        if (window.confirm("Are you sure you want to delete this KOL profile?")) {
          try {
            await onDelete?.(kolId);
          } catch {
            // no-op
          }
        }
      },
      [onDelete],
    );

    const tableHeaders = useMemo(
      () => [
        { key: "kol", label: "KOL", width: "w-64" },
        { key: "contact", label: "Contact", width: "w-48" },
        { key: "category", label: "Category", width: "w-40" },
        { key: "social", label: "Social Stats", width: "w-48" },
        { key: "rate", label: "Rate Range", width: "w-40" },
        { key: "performance", label: "Performance", width: "w-32" },
        { key: "posts", label: "Posts", width: "w-32" },
        { key: "campaigns", label: "Campaigns", width: "w-36" },
        { key: "status", label: "Status", width: "w-40" },
        { key: "actions", label: "Actions", width: "w-20" },
      ],
      [],
    );

    const activeKOLs = useMemo(
      () => profiles.filter((p) => p.status?.toLowerCase() === "active").length,
      [profiles],
    );

    const renderKOLRows = useMemo(
      () =>
        profiles.map((profile) => (
          <KOLManagementTableRow
            key={profile.id}
            profile={profile}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            onViewRatings={handleViewRatings}
            onDelete={handleDelete}
            hasRating={hasRating}
            getPerformanceRating={getPerformanceRating}
            formatNumber={formatNumber}
            activePosts={aggregatedMetrics?.activePosts || 0}
          />
        )),
      [
        profiles,
        handleViewDetails,
        handleEdit,
        handleViewRatings,
        handleDelete,
        hasRating,
        getPerformanceRating,
        formatNumber,
        aggregatedMetrics,
      ],
    );

    return (
      <>
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full caption-bottom text-sm kol-management-table">
              <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  {tableHeaders.map((header) => (
                    <TableHead
                      key={header.key}
                      className={`bg-gray-50 px-3 text-xs font-medium text-gray-700 whitespace-nowrap ${header.width}`}
                    >
                      {header.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center">
                      <LoadingDots size="lg" />
                    </TableCell>
                  </TableRow>
                ) : profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <Users className="h-12 w-12 text-gray-300" />
                        <div>No KOL profiles found</div>
                        <div className="text-xs text-gray-400">
                          Try adjusting your filters or search terms
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  renderKOLRows
                )}
              </TableBody>
            </table>
          </div>

          <KOLManagementTableFooter
            totalKOLs={profiles.length}
            activeKOLs={activeKOLs}
            filteredKOLs={profiles.length}
            selectedCategory={selectedCategory}
          />
        </div>

        {selectedKOLId && (
          <>
            <KOLDetailModal
              open={isDetailModalOpen}
              onOpenChange={setIsDetailModalOpen}
              kolId={selectedKOLId}
            />
            <EditKOLModal
              open={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              kolId={selectedKOLId}
            />
            <KOLRatingsModal
              isOpen={isRatingsModalOpen}
              onClose={() => setIsRatingsModalOpen(false)}
              kolId={selectedKOLId}
              kolName={selectedKOLName}
            />
          </>
        )}
      </>
    );
  },
);

KOLManagementTable.displayName = "KOLManagementTable";

