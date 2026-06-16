import React, { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';
import { ContentPlan, ContentType, Service, SubService, ContentPillar } from '../types/social-media';
import { useCarouselCountsMap } from '../hook/useCarouselImages';
import { TableHeader } from './table/TableHeader';
import { ContentPlanRow } from './table/ContentPlanRow';
import { LoadingDots } from '@/shared/components/LoadingDots';
import type { DigitalMarketingEmployee } from '../hook/useDigitalMarketingEmployees';
import type { CreativeEmployee } from '../hook/useCreativeEmployees';
import type { ApprovalAccess } from '../hook/useBatchApprovalAccess';
import type { SocialMediaLink } from '@/shared/types/social-media-links';

interface ContentPlanTableProps {
  contentPlans: ContentPlan[];
  contentTypes: ContentType[];
  services: Service[];
  subServices: SubService[];
  contentPillars: ContentPillar[];
  linksByPlanId?: Record<string, SocialMediaLink[]>;
  digitalEmployees?: DigitalMarketingEmployee[];
  creativeEmployees?: CreativeEmployee[];
  currentUserRole?: string | null;
  onSelectItem: (id: string, checked: boolean) => void;
  selectedItems: string[];
  onFieldChange: (id: string, field: string, value: any) => void | Promise<void>;
  onOpenBriefDialog: (id: string, brief: string | null) => void;
  onOpenTitleDialog: (id: string, title: string | null, approved?: boolean) => void;
  onContentTypeDataChange: () => void;
  onServiceDataChange: () => void;
  onContentPillarDataChange: () => void;
  loading?: boolean;
  approvalAccess?: ApprovalAccess; // Batch-checked approval access from parent
  /** When true, empty state shows "no match for filters" instead of "no content plans". */
  hasActiveFilters?: boolean;
  requestApproval?: (plan: ContentPlan, oldStatus: string | null, oldApproved?: boolean, oldCompletionDate?: string | null) => boolean; // Hook untuk approval dengan task step
  handleUnapproval?: (planId: string) => Promise<void>; // Hook untuk un-approval dengan task step deletion
  onCarouselFirstUploadSuccess?: (planId: string) => void; // When first carousel image uploaded, auto-populate PIC Production
  onCarouselAllRemoved?: (planId: string) => void; // When all carousel images removed, reset PIC Production
  onProductionResubmitForReview?: (planId: string) => void | Promise<void>;
}

export const ContentPlanTable: React.FC<ContentPlanTableProps> = ({
  contentPlans,
  contentTypes,
  services,
  subServices,
  contentPillars,
  linksByPlanId = {},
  digitalEmployees = [],
  creativeEmployees = [],
  currentUserRole = null,
  onSelectItem,
  selectedItems,
  onFieldChange,
  onOpenBriefDialog,
  onOpenTitleDialog,
  loading = false,
  approvalAccess,
  hasActiveFilters = false,
  requestApproval,
  handleUnapproval,
  onCarouselFirstUploadSuccess,
  onCarouselAllRemoved,
  onProductionResubmitForReview
}) => {
  const planIds = useMemo(() => contentPlans.map((p) => p.id), [contentPlans]);
  const { countsMap: carouselCountsMap, refetch: refetchCarouselCounts } = useCarouselCountsMap(planIds);
  const onCarouselChange = useCallback(() => {
    refetchCarouselCounts();
  }, [refetchCarouselCounts]);

  // Helper function to filter sub-services based on service
  const getFilteredSubServices = useCallback(
    (serviceId: string | null): SubService[] => {
      if (!serviceId) return [];
      return subServices.filter((sub) => sub.service_id === serviceId);
    },
    [subServices]
  );

  // Format date time helper
  const formatDateTime = useCallback((date: string | Date): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Format date only helper
  const formatDateOnly = useCallback((date: string | Date): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }, []);

  // Status change handlers with revision count logic
  const handleStatusChange = useCallback(
    (id: string, value: string) => {
      // Find the current plan to get current status and revision count
      const currentPlan = contentPlans.find(plan => plan.id === id);
      
      if (!currentPlan) {
        // Fallback if plan not found
        onFieldChange(id, 'status', value);
        return;
      }

      const oldStatus = currentPlan.status || null;
      const isChangingToApproved = value === 'Approved';
      const isChangingToNeedReview = value === 'Need Review';

      // Special handling untuk status change ke "Approved" dengan requestApproval hook
      if (isChangingToApproved && requestApproval) {
        // Check apakah perlu show modal untuk memilih daily task
        // Pass oldApproved dan oldCompletionDate untuk rollback jika modal dibatalkan
        const oldApproved = currentPlan.approved || false;
        const oldCompletionDate = currentPlan.completion_date || null;
        const shouldPreventUpdate = requestApproval(currentPlan, oldStatus, oldApproved, oldCompletionDate);
        if (shouldPreventUpdate) {
          // Prevent normal update, modal akan handle update setelah task dipilih
          return;
        }
      }

      // Special handling untuk status change dari "Approved" ke "Need Review" (un-approval)
      // Delete task_steps ketika status berubah dari "Approved" ke "Need Review"
      // NON-BLOCKING: jangan di-await supaya dropdown status tetap responsif
      if (isChangingToNeedReview && oldStatus === 'Approved' && handleUnapproval) {
        // Status berubah dari "Approved" ke "Need Review" - hapus task_steps di background
        handleUnapproval(id).catch((error) => {
          devLog.error('Error during unapproval task step deletion (table):', error);
          toast.error('Failed to remove approval task');
        });
      }

      // If changing to "Request Revision", increment revision count
      if (value === 'Request Revision' && currentPlan.status !== 'Request Revision') {
        const newRevisionCount = (currentPlan.revision_count || 0) + 1;
        onFieldChange(id, 'status', value);
        onFieldChange(id, 'revision_count', newRevisionCount);
      } else {
        // Regular status change
        onFieldChange(id, 'status', value);
      }
    },
    [onFieldChange, contentPlans, requestApproval, handleUnapproval]
  );

  const handleProductionStatusChange = useCallback(
    (id: string, value: string | null) => {
      // Find the current plan to get current production status and revision count
      const currentPlan = contentPlans.find(plan => plan.id === id);
      
      if (currentPlan) {
        // If changing to "Request Revision", increment production revision count and clear completion date
        if (value === 'Request Revision') {
          // Only increment revision count if status is NOT already "Request Revision"
          const shouldIncrement = currentPlan.production_status !== 'Request Revision';
          const newProductionRevisionCount = shouldIncrement 
            ? (currentPlan.production_revision_count || 0) + 1
            : (currentPlan.production_revision_count || 0);
          
          devLog.debug('handleProductionStatusChange: Request Revision', {
            planId: id,
            newRevisionCount: newProductionRevisionCount,
            shouldIncrement,
          });
          
          // Update all fields - these will be batched together (30ms debounce)
          // IMPORTANT: Always clear production_completion_date when status is "Request Revision"
          onFieldChange(id, 'production_status', value);
          
          // Only update revision count if we're incrementing it
          if (shouldIncrement) {
            onFieldChange(id, 'production_revision_count', newProductionRevisionCount);
          }
          
          // ALWAYS clear production_completion_date when status is "Request Revision"
          // This ensures it's cleared even if status was already "Request Revision"
          onFieldChange(id, 'production_completion_date', null);
          
          // Also reset production_approved and clear approved date
          onFieldChange(id, 'production_approved', false);
          onFieldChange(id, 'production_approved_date', null);
          
          // google_drive_link is NOT cleared on Request Revision; step uncomplete is triggered by mutation onSuccess

          devLog.debug('All fields queued for update (batched in 30ms)');
        } else {
          // Regular production status change (can be null for "No Status")
          onFieldChange(id, 'production_status', value);
        }
      } else {
        // Fallback if plan not found
        onFieldChange(id, 'production_status', value);
      }
    },
    [onFieldChange, contentPlans]
  );

  const handleStatusContentChange = useCallback(
    (id: string, value: string) => {
      onFieldChange(id, 'status_content', value);
    },
    [onFieldChange]
  );

  const handleResetRevision = useCallback(
    (id: string, field: 'revision_count' | 'production_revision_count') => {
      onFieldChange(id, field, 0);
    },
    [onFieldChange]
  );

  const handleOpenLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Loading state (satu scroll per panel: scroll di parent, jangan nested overflow)
  if (loading) {
    return (
      <div className="w-full min-h-0 flex items-center justify-center py-8">
        <LoadingDots size="lg" />
      </div>
    );
  }

  // Empty state
  if (contentPlans.length === 0) {
    return (
      <div className="w-full min-h-0">
        <table className="w-full border-collapse table-fixed">
          <TableHeader />
          <tbody>
            <tr>
              <td colSpan={24} className="p-8 text-center text-gray-500">
                {hasActiveFilters
                  ? 'No content plans match the current filters. Try changing Status, Month, or Service.'
                  : 'No content plans found. Create a new content plan to get started.'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0">
      <table className="w-full border-collapse table-fixed">
        <TableHeader />
        <tbody>
          {contentPlans.map((plan) => (
            <ContentPlanRow
              key={plan.id}
              plan={plan}
              planLinks={linksByPlanId[plan.id] ?? []}
              contentTypes={contentTypes}
              services={services}
              subServices={subServices}
              contentPillars={contentPillars}
              digitalEmployees={digitalEmployees}
              creativeEmployees={creativeEmployees}
              currentUserRole={currentUserRole}
              selectedItems={selectedItems}
              onSelectItem={onSelectItem}
              onFieldChange={onFieldChange}
              onOpenBriefDialog={onOpenBriefDialog}
              onOpenTitleDialog={onOpenTitleDialog}
              onStatusChange={handleStatusChange}
              onProductionStatusChange={handleProductionStatusChange}
              onStatusContentChange={handleStatusContentChange}
              onResetRevision={handleResetRevision}
              onOpenLink={handleOpenLink}
              getFilteredSubServices={getFilteredSubServices}
              formatDateTime={formatDateTime}
              formatDateOnly={formatDateOnly}
              approvalAccess={approvalAccess}
              carouselImageCount={carouselCountsMap[plan.id] ?? 0}
              onCarouselChange={onCarouselChange}
              onCarouselFirstUploadSuccess={onCarouselFirstUploadSuccess}
              onCarouselAllRemoved={onCarouselAllRemoved}
              onProductionResubmitForReview={onProductionResubmitForReview}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

