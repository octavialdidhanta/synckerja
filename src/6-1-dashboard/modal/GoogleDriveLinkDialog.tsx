import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { ExternalLink, Check, RotateCcw, LinkIcon, Calendar, FileText, Tag, Lock, Share2, Upload, GripVertical, Trash2, ImageIcon, ChevronDown, ChevronUp, User, Briefcase } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { OptimizedCommentPanel } from './OptimizedCommentPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import GoogleDriveFolderCarousel from './GoogleDriveFolderCarousel';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { usePublicReviewToken } from '../hook/usePublicReviewToken';
import { useProdApprovalAccess } from '../hook/useProdApprovalAccess';
import { useCarouselImages, getCarouselImagePublicUrl, CAROUSEL_QUERY_KEY } from '../hook/useCarouselImages';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { isFileLink, linksSemanticallyEqual } from '../utils/previewUtils';
import { revertStepCompletionFromDriveLinkRemovalWithRpc } from '@/8-2-DailyTask/services/completionApprovalService';
import { setGoogleDriveModalOpenPlanId } from '../hook/briefModalOpenRef';
import { GoogleDriveFilePreview } from './GoogleDriveInAppFilePreview';
import { GoogleDriveIframeFilePreview } from './GoogleDriveIframeFilePreview';
import { useGoogleDriveOAuthConnection } from '../hook/useGoogleDriveOAuthConnection';
import { startGoogleDriveOAuthAsync } from '@/shared/lib/googleDriveOAuth';
import {
  GOOGLE_PICKER_HOST_CLOSE_EVENT,
  GOOGLE_PICKER_HOST_OPEN_EVENT,
  isGooglePickerHostSessionActive,
} from '@/shared/lib/googleDrivePicker';

const CAROUSEL_MAX_IMAGES = 10;

interface GoogleDriveLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  googleDriveLink: string;
  onSave: (link: string) => void;
  socialMediaPlanId: string;
  planTitle?: string;
  onApprove?: () => void;
  onRevision?: () => void;
  status?: 'draft' | 'approved' | 'revision' | 'completed';
  // New props for content information
  contentTitle?: string;
  contentType?: string;
  postDate?: string;
  /** Service name (from joined services.name) */
  serviceName?: string | null;
  /** PIC Production display name (from joined employees.full_name) */
  picProductionName?: string | null;
  productionApproved?: boolean; // Lock input field if production is approved
  productionStatus?: string | null; // When 'Request Revision', show "Clear all carousel" button
  /** DB baseline when status became Request Revision (same as google_drive_link until reviewer requests revision). */
  revisionBaselineLink?: string | null;
  /** Promote to Need Review when URL unchanged (e.g. folder) but PIC confirms resubmission. */
  onResubmitForReview?: () => void | Promise<void>;
  onCarouselChange?: () => void; // Called after carousel images change (for cache invalidation)
  onCarouselFirstUploadSuccess?: (planId: string) => void; // Called when first carousel image is uploaded (to auto-populate PIC Production)
  onCarouselAllRemoved?: (planId: string) => void; // Called when all carousel images are removed (to reset PIC Production)
}
const isCarouselContentType = (t: string | undefined) => t === 'Post' || t === 'Carousel';

const isVideoContentType = (t: string | undefined) => {
  if (!t) return false;
  const lower = t.toLowerCase();
  return lower === 'reel' || lower === 'story' || lower === 'video';
};

const GoogleDriveLinkDialog: React.FC<GoogleDriveLinkDialogProps> = ({
  isOpen,
  onClose,
  googleDriveLink,
  onSave,
  socialMediaPlanId,
  planTitle,
  onApprove,
  onRevision,
  status = 'draft',
  contentTitle,
  contentType,
  postDate,
  serviceName,
  picProductionName,
  productionApproved = false,
  productionStatus,
  revisionBaselineLink = null,
  onResubmitForReview,
  onCarouselChange,
  onCarouselFirstUploadSuccess,
  onCarouselAllRemoved
}) => {
  const { t } = useAppTranslation();
  const isCarouselMode = isCarouselContentType(contentType);
  const [currentLink, setCurrentLink] = useState(googleDriveLink);
  const [carouselPreviewIndex, setCarouselPreviewIndex] = useState(0);
  const [carouselSectionExpanded, setCarouselSectionExpanded] = useState(true);
  const carouselFileInputRef = useRef<HTMLInputElement>(null);
  const { canShowApprovalButtons } = useProdApprovalAccess(isOpen);
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const { getOrCreate, isPending: isPublicLinkPending } = usePublicReviewToken();
  const {
    images: carouselImages,
    isLoading: carouselLoading,
    upload: carouselUpload,
    remove: carouselRemove,
    reorder: carouselReorder,
    removeAll: carouselRemoveAll,
    isUploading: carouselIsUploading,
    isDeleting: carouselIsDeleting,
    isReordering: carouselIsReordering,
    isRemovingAll: carouselIsRemovingAll,
    refetch: carouselRefetch,
    count: carouselCount,
  } = useCarouselImages(isCarouselMode ? socialMediaPlanId : undefined);

  const {
    connected: driveGoogleConnected,
    needsReconnect: driveNeedsReconnect,
    pending: driveConnPending,
    disconnect: disconnectGoogleDrive,
  } = useGoogleDriveOAuthConnection(isOpen);

  const [pickerHostOpen, setPickerHostOpen] = useState(() => isGooglePickerHostSessionActive());

  useEffect(() => {
    const onOpen = () => setPickerHostOpen(true);
    const onClose = () => setPickerHostOpen(false);
    window.addEventListener(GOOGLE_PICKER_HOST_OPEN_EVENT, onOpen);
    window.addEventListener(GOOGLE_PICKER_HOST_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(GOOGLE_PICKER_HOST_OPEN_EVENT, onOpen);
      window.removeEventListener(GOOGLE_PICKER_HOST_CLOSE_EVENT, onClose);
    };
  }, []);

  const blockDialogDismissWhilePicker = useCallback((event: Event) => {
    if (isGooglePickerHostSessionActive()) {
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (isOpen && socialMediaPlanId) {
      setGoogleDriveModalOpenPlanId(socialMediaPlanId);
      return () => setGoogleDriveModalOpenPlanId(null);
    }
    setGoogleDriveModalOpenPlanId(null);
    return undefined;
  }, [isOpen, socialMediaPlanId]);

  useEffect(() => {
    if (isCarouselMode && carouselImages.length > 0) {
      setCarouselPreviewIndex((i) => (i >= carouselImages.length ? carouselImages.length - 1 : i));
    } else if (isCarouselMode) {
      setCarouselPreviewIndex(0);
    }
  }, [isCarouselMode, carouselImages.length]);

  // Track previous link to only log on actual changes
  const prevLinkRef = useRef<string | undefined>(undefined);
  const isInitialMount = useRef(true);
  
  // Update currentLink when googleDriveLink prop changes
  useEffect(() => {
    // Skip log on initial mount (prevLinkRef is undefined)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevLinkRef.current = googleDriveLink;
      setCurrentLink(googleDriveLink);
      return;
    }
    
    // Only log if link actually changed (not initial mount)
    if (prevLinkRef.current !== googleDriveLink) {
      devLog.debug('🔗 GoogleDriveLinkDialog - googleDriveLink changed:', {
        previousLink: prevLinkRef.current,
        newLink: googleDriveLink,
        socialMediaPlanId
      });
      prevLinkRef.current = googleDriveLink;
    }
    setCurrentLink(googleDriveLink);
  }, [googleDriveLink, socialMediaPlanId]);

  // Auto-save functionality with debouncing (disabled when production is approved or carousel mode)
  useEffect(() => {
    if (productionApproved || isCarouselMode) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (currentLink !== googleDriveLink) {
        onSave(currentLink);
        if (currentLink && currentLink.trim() !== '') {
          toast.success('Google Drive Link saved automatically');
        } else if (googleDriveLink && (!currentLink || currentLink.trim() === '')) {
          toast.success('Google Drive Link removed automatically');
        }
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [currentLink, googleDriveLink, onSave, productionApproved]);

  const openLink = () => {
    if (currentLink) {
      window.open(currentLink, '_blank');
    }
  };

  const effectiveBaseline = (revisionBaselineLink ?? googleDriveLink ?? '').trim();
  const showResubmitForReview = useMemo(
    () =>
      !isCarouselMode &&
      !productionApproved &&
      productionStatus === 'Request Revision' &&
      Boolean(onResubmitForReview) &&
      currentLink.trim().length > 0 &&
      linksSemanticallyEqual(currentLink, effectiveBaseline),
    [
      isCarouselMode,
      productionApproved,
      productionStatus,
      onResubmitForReview,
      currentLink,
      effectiveBaseline,
    ]
  );

  const handleResubmitForReviewClick = async () => {
    if (!onResubmitForReview) return;
    try {
      await onResubmitForReview();
      toast.success(
        t('googleDrivePreview.resubmitForReviewSuccess', 'Dikirim ulang untuk review.')
      );
    } catch (e) {
      devLog.error('onResubmitForReview failed', e);
      toast.error(t('googleDrivePreview.resubmitForReviewFailed', 'Gagal mengirim ulang. Coba lagi.'));
    }
  };

  /** Do not force Need Review on close when link unchanged (fixes Request Revision / folder workflows). */
  const handleClose = async () => {
    if (isCarouselMode) {
      onCarouselChange?.();
      onClose();
      return;
    }
    // Don't save if production is approved (field is locked)
    if (productionApproved) {
      onClose();
      return;
    }

    if (currentLink !== googleDriveLink) {
      onSave(currentLink);
    } else if (googleDriveLink && (!currentLink || currentLink.trim() === '')) {
      // If link was removed (had link before, but now empty), clear production_completion_date
      // This should be handled by onSave, but we do it here as backup
      try {
        const {
          supabase
        } = await import('@/shared/lib/supabaseClient');
        const {
          data,
          error
        } = await supabase.from('social_media_plans').update({
          production_completion_date: null
        }).eq('id', socialMediaPlanId)
        .select()
        .single();
        
        if (error) {
          devLog.error('Error clearing production completion date:', error);
        } else {
          devLog.debug('Production completion date cleared when Google Drive link was removed');
          // Update cache with new data using correct query key
          if (organizationId && data) {
            queryClient.setQueryData(
              ['social-media-plans', organizationId],
              (oldData: any) => {
                if (!oldData) return oldData;
                return oldData.map((plan: any) => 
                  plan.id === socialMediaPlanId ? { ...plan, production_completion_date: null } : plan
                );
              }
            );
            // Also invalidate to ensure all related queries refresh
            queryClient.invalidateQueries({ queryKey: ['social-media-plans', organizationId] });
          } else {
            // Fallback: invalidate all social-media-plans queries
            queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
          }
        }
      } catch (error) {
        devLog.error('Error in handleClose (clearing date):', error);
      }
    }
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    if (isGooglePickerHostSessionActive()) return;
    void handleClose();
  };

  // POINT 2 & 3: Handle revision with production status update and clear completion date
  const handleRevision = async () => {
    if (!canShowApprovalButtons) {
      toast.error('You do not have permission to request revision');
      return;
    }

    if (!socialMediaPlanId) {
      toast.error('Plan ID is missing');
      return;
    }

    try {
      // Get current production revision count
      const { data: currentPlan, error: fetchError } = await supabase
        .from('social_media_plans')
        .select('production_revision_count, production_status')
        .eq('id', socialMediaPlanId)
        .single();

      if (fetchError) {
        devLog.error('Error fetching current plan:', fetchError);
        toast.error('Failed to fetch current data');
        return;
      }

      // Only increment if status is not already "Request Revision"
      const shouldIncrement = currentPlan.production_status !== 'Request Revision';
      const newProductionRevisionCount = shouldIncrement 
        ? (currentPlan.production_revision_count || 0) + 1
        : (currentPlan.production_revision_count || 0);

      // Update production status and related fields (do not clear google_drive_link)
      const updateData: any = {
        production_status: 'Request Revision',
        production_completion_date: null, // POINT 2: Clear completion date when requesting revision
        production_approved: false, // Reset approval status
        production_approved_date: null, // Clear approved date
      };

      // Only update revision count if we're incrementing it
      if (shouldIncrement) {
        updateData.production_revision_count = newProductionRevisionCount;
      }

      devLog.debug('Updating database (revision)', updateData);
      const { error, data } = await supabase
        .from('social_media_plans')
        .update(updateData)
        .eq('id', socialMediaPlanId)
        .select('production_status, production_approved, production_completion_date, production_revision_count')
        .maybeSingle();

      if (error) {
        devLog.error('Error updating production status for revision:', error);
        toast.error(
          error.message ||
            t(
              'googleDrivePreview.revisionSaveFailed',
              'Failed to save Request Revision. Check your connection or try again.'
            )
        );
        return;
      }

      if (!data || data.production_status !== 'Request Revision') {
        devLog.error('production_status was not persisted as Request Revision', {
          expected: 'Request Revision',
          actual: data?.production_status,
          noRow: !data,
        });
        toast.error(
          t(
            'googleDrivePreview.revisionNotPersisted',
            'Request Revision was not saved (no row updated or wrong status). You may lack permission, or the server rejected the change. Refresh and try again.'
          )
        );
        return;
      }

      // Uncomplete assignee step + reject pending approval (await so it finishes before modal closes)
      if (organizationId) {
        const { error: revertErr } = await revertStepCompletionFromDriveLinkRemovalWithRpc({
          organizationId,
          socialMediaPlanId,
          rejectedByEmployeeId: currentEmployee?.id ?? undefined,
        });
        if (revertErr) {
          devLog.warn('revertStepCompletionFromDriveLinkRemovalWithRpc failed', {
            planId: socialMediaPlanId,
            message: revertErr.message,
          });
          toast.error(
            t(
              'googleDrivePreview.revisionStepRevertFailed',
              'Status updated but failed to reopen the assigned task step. Please refresh or contact support.'
            )
          );
        }
      }

      toast.success(
        t('googleDrivePreview.revisionSuccess', 'Production status updated to Request Revision')
      );
      devLog.debug('Production completion date cleared and status set to Request Revision', {
        planId: socialMediaPlanId,
        newRevisionCount: newProductionRevisionCount,
        wasIncremented: shouldIncrement
      });

      // Optional parent hook (e.g. analytics). Do not persist plan here — this dialog already saved + RPC above.
      if (onRevision) {
        onRevision();
        devLog.debug('onRevision callback executed', { planId: socialMediaPlanId });
      }

      // Optimistic update cache immediately for instant UI feedback
      if (queryClient && organizationId) {
        const queryKey = ['social-media-plans', organizationId];
        
        // Get current cache data
        const currentData = queryClient.getQueryData(queryKey) as any[];
        
        if (currentData) {
          // Update cache optimistically with new values
          queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((plan: any) => {
              if (plan.id === socialMediaPlanId) {
                return {
                  ...plan,
                  production_status: 'Request Revision',
                  production_completion_date: null,
                  production_approved: false,
                  production_approved_date: null,
                  production_revision_count: newProductionRevisionCount,
                  production_revision_baseline_link: plan.google_drive_link ?? googleDriveLink ?? null,
                };
              }
              return plan;
            });
          });
          
          devLog.debug('✅ Cache updated optimistically for immediate UI feedback', {
            planId: socialMediaPlanId,
            production_status: 'Request Revision',
            production_approved: false,
            production_revision_count: newProductionRevisionCount
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['social-media-plan', socialMediaPlanId] });

        // Delay refetch slightly so replicas/triggers settle (no competing batched PATCH from parent)
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey,
            refetchType: 'active',
          });
          queryClient.invalidateQueries({
            queryKey: ['social-media-plans'],
            refetchType: 'active',
          });
          queryClient.refetchQueries({
            queryKey,
            type: 'active',
          });
        }, 300);
      } else if (queryClient) {
        // Fallback if organizationId is not available
        queryClient.invalidateQueries({ 
          queryKey: ['social-media-plans'],
          refetchType: 'active'
        });
      }
    } catch (error) {
      devLog.error('Error in handleRevision:', error);
      toast.error('Failed to update production status');
    } finally {
      onClose();
    }
  };

  // POINT 1 & 3: Handle approve with production status update and set approved date
  const handleApprove = async () => {
    if (!canShowApprovalButtons) {
      toast.error('You do not have permission to approve content');
      return;
    }
    if (isCarouselMode) {
      if (carouselCount < 1) {
        toast.error('Add at least one carousel image before approving.');
        return;
      }
    }
    if (onApprove) {
      onApprove();
    }
    
    try {
      const { supabase } = await import('@/shared/lib/supabaseClient');
      const approvedDate = new Date().toISOString();
      const { error } = await supabase
        .from('social_media_plans')
        .update({
          production_status: 'Approved',
          production_approved: true,
          production_approved_date: approvedDate // POINT 1: Set approved date when approved with real-time timestamp
        })
        .eq('id', socialMediaPlanId);
        
      if (error) {
        devLog.error('Error updating production status for approval:', error);
        toast.error('Failed to update production status');
      } else {
        toast.success('Production approved successfully');
        devLog.debug('Production status set to Approved, production_approved turned ON, and approved date recorded at:', approvedDate);
      }
    } catch (error) {
      devLog.error('Error in handleApprove:', error);
      toast.error('Failed to approve production');
    }

    onClose();
  };

  const isFolderLink = (url: string) => {
    return url.includes('drive.google.com/drive/folders/');
  };
  const isFileLink = (url: string) => {
    return url.includes('drive.google.com/file/d/');
  };
  const isYouTubeLink = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };
  const formatDisplayDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  const getStatusBadge = () => {
    const statusConfig = {
      draft: {
        label: 'Draft',
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-700'
      },
      approved: {
        label: 'Approved',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-700'
      },
      revision: {
        label: 'Needs Revision',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-700'
      },
      completed: {
        label: 'Completed',
        variant: 'default' as const,
        className: 'bg-blue-100 text-blue-700'
      }
    };
    const config = statusConfig[status];
    return <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>;
  };

  const handleCarouselFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !isCarouselMode) return;
      if (carouselCount >= CAROUSEL_MAX_IMAGES) {
        toast.error(`Maximum ${CAROUSEL_MAX_IMAGES} images allowed.`);
        return;
      }
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isJpg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
        if (!isJpg) {
          toast.error('Only JPG files are allowed.');
          continue;
        }
        if (carouselCount + i >= CAROUSEL_MAX_IMAGES) {
          toast.error(`Maximum ${CAROUSEL_MAX_IMAGES} images allowed.`);
          break;
        }
        try {
          await carouselUpload(file);
          if (carouselCount === 0) {
            onCarouselFirstUploadSuccess?.(socialMediaPlanId);
          }
          onCarouselChange?.();
        } catch (_) {
          // toast from hook
        }
      }
      e.target.value = '';
    },
    [isCarouselMode, carouselCount, carouselUpload, onCarouselFirstUploadSuccess, onCarouselChange, socialMediaPlanId]
  );

  const handleCarouselDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isCarouselMode || productionApproved) return;
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)
      );
      const nonJpg = e.dataTransfer.files.length - files.length;
      if (nonJpg > 0) toast.error('Only JPG files are allowed.');
      let added = 0;
      (async () => {
        for (const file of files) {
          if (carouselCount + added >= CAROUSEL_MAX_IMAGES) {
            toast.error(`Maximum ${CAROUSEL_MAX_IMAGES} images allowed.`);
            break;
          }
          try {
            await carouselUpload(file);
            added++;
            if (carouselCount === 0 && added === 1) {
              onCarouselFirstUploadSuccess?.(socialMediaPlanId);
            }
            onCarouselChange?.();
          } catch (_) {}
        }
      })();
    },
    [isCarouselMode, productionApproved, carouselCount, carouselUpload, onCarouselFirstUploadSuccess, onCarouselChange, socialMediaPlanId]
  );

  const handleCarouselDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSharePublicLink = async () => {
    if (isCarouselMode) {
      if (carouselCount < 1) {
        toast.error('Upload at least one carousel image before sharing review link.');
        return;
      }
      try {
        const { publicReviewUrl } = await getOrCreate({ socialMediaPlanId, linkUrl: 'carousel' });
        await navigator.clipboard.writeText(publicReviewUrl);
        toast.success('Link review publik disalin ke clipboard');
      } catch (e) {
        devLog.debug('Share public link failed:', e);
        toast.error('Gagal membuat atau menyalin link review publik');
      }
      return;
    }
    const linkToUse = currentLink?.trim() || googleDriveLink?.trim();
    if (!linkToUse) {
      toast.error('Tambahkan Google Drive link terlebih dahulu');
      return;
    }
    try {
      const { publicReviewUrl } = await getOrCreate({ socialMediaPlanId, linkUrl: linkToUse });
      await navigator.clipboard.writeText(publicReviewUrl);
      toast.success('Link review publik disalin ke clipboard');
    } catch (e) {
      devLog.debug('Share public link failed:', e);
      toast.error('Gagal membuat atau menyalin link review publik');
    }
  };

  return <Dialog open={isOpen} onOpenChange={handleOpenChange} modal={!pickerHostOpen}>
      <DialogContent
        hideCloseButton
        fullscreenAnimation
        onInteractOutside={blockDialogDismissWhilePicker}
        onPointerDownOutside={blockDialogDismissWhilePicker}
        onFocusOutside={blockDialogDismissWhilePicker}
        className="fixed left-0 right-0 top-0 z-50 flex h-dvh max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-none sm:rounded-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Google Drive Link</DialogTitle>
          <DialogDescription>Manage Google Drive link and comments for this content plan</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-1 gap-4 px-2 py-2 sm:gap-6 sm:px-3 sm:py-2">
          {/* Left side - Preview area with full width/height */}
          <div className="flex min-w-0 min-h-0 flex-[2] flex-col basis-0">
            {/* Preview area - Always show if there's a link */}
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <h4 className="font-medium text-sm text-gray-900">Preview</h4>
                    {driveConnPending ? (
                      <span className="inline-flex h-7 items-center text-xs text-gray-500 px-1">
                        {t('googleDrivePreview.connectionLoading')}
                      </span>
                    ) : driveGoogleConnected ? (
                      <>
                        {driveNeedsReconnect ? (
                          <span className="max-w-[14rem] text-xs leading-tight text-amber-700">
                            {t(
                              'googleDrivePreview.reconnectForDriveFileScope',
                              'Hubungkan ulang Google untuk izin Drive terbaru (drive.file).',
                            )}
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-800 border-red-200 hover:bg-red-50"
                          title={t('googleDrivePreview.disconnectGoogleHint')}
                          onClick={async () => {
                            const result = await disconnectGoogleDrive();
                            if (!result.ok) {
                              toast.error(
                                result.message ?? t('googleDrivePreview.disconnectGoogleFailed'),
                              );
                            } else {
                              toast.success(t('googleDrivePreview.disconnectGoogleSuccess'));
                            }
                          }}
                        >
                          {t('googleDrivePreview.disconnectGoogle')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        title={t('googleDrivePreview.connectGoogleHint')}
                        onClick={async () => {
                          const r = await startGoogleDriveOAuthAsync();
                          if (!r.ok) {
                            if (r.reason === 'missing_client_id') {
                              toast.error(t('googleDrivePreview.connectGoogleMissingClientId'));
                            } else {
                              toast.error(t('googleDrivePreview.connectGooglePopupBlocked'));
                            }
                          }
                        }}
                      >
                        {t('googleDrivePreview.connectGoogle')}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs justify-end min-w-0">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-gray-600" />
                      <span className="text-gray-700 font-medium">Title:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">{contentTitle || 'No title'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-gray-600" />
                      <span className="text-gray-700 font-medium">Type:</span>
                      <span className="text-gray-800">{contentType || 'No type'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-600" />
                      <span className="text-gray-700 font-medium">Date:</span>
                      <span className="text-gray-800">{postDate ? formatDisplayDate(postDate) : 'No date'}</span>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <Briefcase className="h-3 w-3 text-gray-600 flex-shrink-0" />
                      <span className="text-gray-700 font-medium flex-shrink-0">{t('socialMediaDashboard.reviewModal.service', 'Service')}:</span>
                      <span className="text-gray-800 truncate max-w-[180px]" title={serviceName?.trim() || undefined}>
                        {serviceName?.trim()
                          ? serviceName.trim()
                          : t('socialMediaDashboard.reviewModal.noService', '—')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <User className="h-3 w-3 text-gray-600 flex-shrink-0" />
                      <span className="text-gray-700 font-medium flex-shrink-0">{t('socialMediaDashboard.reviewModal.picProduction', 'PIC Production')}:</span>
                      <span className="text-gray-800 truncate max-w-[180px]" title={picProductionName?.trim() || undefined}>
                        {picProductionName?.trim()
                          ? picProductionName.trim()
                          : t('socialMediaDashboard.reviewModal.noPicProduction', '—')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white p-2">
                {isCarouselMode ? (
                  carouselImages.length > 0 ? (
                    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden">
                      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
                        <img
                          src={getCarouselImagePublicUrl(carouselImages[carouselPreviewIndex]?.storage_path)}
                          alt={`Carousel ${carouselPreviewIndex + 1}`}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={carouselPreviewIndex <= 0}
                          onClick={() => setCarouselPreviewIndex((i) => Math.max(0, i - 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          {carouselPreviewIndex + 1} / {carouselImages.length}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={carouselPreviewIndex >= carouselImages.length - 1}
                          onClick={() => setCarouselPreviewIndex((i) => Math.min(carouselImages.length - 1, i + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : carouselLoading ? (
                    <p className="text-sm text-gray-500">Loading...</p>
                  ) : (
                    <div className="text-center p-8">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-700">Upload JPG untuk preview carousel</p>
                    </div>
                  )
                ) : currentLink ? <>
                    {isFolderLink(currentLink) ? (
                      <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-hidden">
                        <GoogleDriveFolderCarousel folderUrl={currentLink} />
                      </div>
                    ) : isYouTubeLink(currentLink) ? <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-gray-50">
                        <div className="text-center p-8">
                          <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ExternalLink className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-700 mb-4 max-w-sm">
                            YouTube links cannot be previewed here due to security restrictions.
                          </p>
                          <Button onClick={openLink} variant="outline" size="sm" className="rounded-lg">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open YouTube Link
                          </Button>
                        </div>
                      </div> : isFileLink(currentLink) ? (
                      driveConnPending ? (
                        <div
                          className="flex h-full min-h-0 w-full flex-1 animate-pulse rounded-lg bg-neutral-950"
                          aria-busy
                          aria-label={t('googleDrivePreview.connectionLoading')}
                        />
                      ) : driveGoogleConnected ? (
                        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
                          <GoogleDriveFilePreview
                            link={currentLink}
                            className="min-h-0 flex-1"
                            forceVideo={isVideoContentType(contentType)}
                          />
                        </div>
                      ) : (
                        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
                          <GoogleDriveIframeFilePreview link={currentLink} className="min-h-0 flex-1" />
                        </div>
                      )
                    ) : <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-gray-50">
                        <div className="text-center p-8">
                          <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LinkIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-700 mb-4 max-w-sm">
                            Preview not available for this link type
                          </p>
                        </div>
                      </div>}
                  </> : (
                    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-gray-50">
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
                          <LinkIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="max-w-sm text-sm text-gray-700">Enter a Google Drive link to see preview</p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Right side - Comments Panel (larger width) */}
          <div className="w-[540px] min-w-[540px] border-l border-gray-200 flex flex-col min-h-0">
            {isCarouselMode && (
            <Collapsible open={carouselSectionExpanded} onOpenChange={setCarouselSectionExpanded} className="flex-shrink-0 border-b border-gray-200">
              <div className="p-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 text-left rounded hover:bg-gray-50 transition-colors py-0.5"
                  >
                    <h4 className="font-medium text-sm text-gray-900">Carousel images (JPG, max {CAROUSEL_MAX_IMAGES})</h4>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      {carouselCount} image{carouselCount !== 1 ? 's' : ''}
                      {carouselSectionExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                    </span>
                  </button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  {productionStatus === 'Request Revision' && carouselCount > 0 && (
                    <div className="flex flex-col gap-1.5 rounded border border-amber-200 bg-amber-50/80 p-2">
                      <p className="text-xs text-amber-800">
                        {t('socialMediaDashboard.carousel.clearAllHint', 'Untuk mengunggah hasil revisi, hapus semua gambar terlebih dahulu.')}
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-fit"
                        disabled={productionApproved || carouselIsRemovingAll}
                        onClick={() => {
                          carouselRemoveAll()
                            .then(() => {
                              onCarouselChange?.();
                              onCarouselAllRemoved?.(socialMediaPlanId);
                            })
                            .catch(() => {});
                        }}
                      >
                        {carouselIsRemovingAll
                          ? t('socialMediaDashboard.carousel.clearing', 'Menghapus...')
                          : t('socialMediaDashboard.carousel.clearAll', 'Hapus semua gambar carousel')}
                      </Button>
                    </div>
                  )}
                  <input
                    ref={carouselFileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={handleCarouselFileSelect}
                  />
                  <div
                    onDrop={productionStatus === 'Request Revision' && carouselCount > 0 ? undefined : handleCarouselDrop}
                    onDragOver={productionStatus === 'Request Revision' && carouselCount > 0 ? undefined : handleCarouselDragOver}
                    onClick={() => {
                      const revisionBlock = productionStatus === 'Request Revision' && carouselCount > 0;
                      if (productionApproved || revisionBlock || carouselCount >= CAROUSEL_MAX_IMAGES) return;
                      carouselFileInputRef.current?.click();
                    }}
                    className={cn(
                      'border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors',
                      productionApproved || carouselCount >= CAROUSEL_MAX_IMAGES || (productionStatus === 'Request Revision' && carouselCount > 0)
                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 bg-gray-50/50 hover:bg-gray-100 text-gray-600 cursor-pointer'
                    )}
                  >
                    <Upload className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                    {productionStatus === 'Request Revision' && carouselCount > 0
                      ? t('socialMediaDashboard.carousel.clearAllFirst', 'Hapus semua gambar terlebih dahulu')
                      : carouselCount >= CAROUSEL_MAX_IMAGES
                      ? `Maximum ${CAROUSEL_MAX_IMAGES} images`
                      : 'Click or drop JPG files'}
                  </div>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {carouselImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="flex items-center gap-2 rounded border border-gray-200 bg-white p-2"
                      >
                        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
                        <img
                          src={getCarouselImagePublicUrl(img.storage_path)}
                          alt={`#${idx + 1}`}
                          className="h-10 w-10 object-cover rounded flex-shrink-0"
                        />
                        <span className="text-xs text-gray-600 flex-1 truncate">#{idx + 1}</span>
                        <div className="flex items-center gap-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={productionApproved || idx <= 0 || carouselIsReordering}
                            onClick={() => {
                              const ids = carouselImages.map((i) => i.id);
                              const next = [...ids];
                              next[idx] = ids[idx - 1];
                              next[idx - 1] = ids[idx];
                              carouselReorder(next);
                            }}
                            title="Move up"
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={productionApproved || idx >= carouselImages.length - 1 || carouselIsReordering}
                            onClick={() => {
                              const ids = carouselImages.map((i) => i.id);
                              const next = [...ids];
                              next[idx] = ids[idx + 1];
                              next[idx + 1] = ids[idx];
                              carouselReorder(next);
                            }}
                            title="Move down"
                          >
                            ↓
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          disabled={productionApproved}
                          onClick={() => {
                            carouselRemove(img.id).then(() => {
                              onCarouselChange?.();
                              if (carouselCount === 1) {
                                onCarouselAllRemoved?.(socialMediaPlanId);
                              }
                            }).catch(() => {});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
            {/* Comments panel - flexible height, no horizontal scroll */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <OptimizedCommentPanel 
                socialMediaPlanId={socialMediaPlanId} 
                linkUrl={isCarouselMode ? 'carousel' : (googleDriveLink || 'default-link')}
              />
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom with horizontally aligned controls */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-2 sm:px-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - Link input (hidden for Post/Carousel) */}
            <div className="min-w-0 flex-1">
              {!isCarouselMode && (
              <div className="space-y-1">
                {productionApproved && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    <Lock className="h-3 w-3" />
                    <span>Link is locked because production is approved. Set production approved to false to edit.</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      value={currentLink} 
                      onChange={e => setCurrentLink(e.target.value)} 
                      placeholder={t(
                        "googleDrivePreview.linkInputPlaceholder",
                        "Tempel tautan Google Drive di sini…",
                      )} 
                      className={`flex-1 h-9 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg ${productionApproved ? 'bg-gray-50 cursor-not-allowed pr-8' : ''}`}
                      disabled={productionApproved}
                      readOnly={productionApproved}
                    />
                    {productionApproved && (
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <Button variant="outline" onClick={openLink} disabled={!currentLink} className="h-9 px-3 border-gray-200 hover:bg-gray-50 rounded-lg">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                {showResubmitForReview && (
                  <p className="text-xs text-gray-600 mt-1">
                    {t(
                      'googleDrivePreview.resubmitForReviewHint',
                      'Link sama dengan versi saat revisi diminta (mis. folder Drive). Setelah memperbarui file di folder, kirim ulang untuk review.'
                    )}
                  </p>
                )}
                {showResubmitForReview && (
                  <Button
                    type="button"
                    variant="default"
                    className="mt-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={() => void handleResubmitForReviewClick()}
                  >
                    {t('googleDrivePreview.resubmitForReview', 'Kirim ulang untuk review')}
                  </Button>
                )}
              </div>
              )}
              {isCarouselMode && (
                <p className="text-sm text-gray-600">Carousel: {carouselCount} / {CAROUSEL_MAX_IMAGES} images</p>
              )}
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSharePublicLink}
                disabled={isCarouselMode ? carouselCount < 1 || isPublicLinkPending : !(currentLink?.trim() || googleDriveLink?.trim()) || isPublicLinkPending}
                className="h-9 px-4 border-gray-200 hover:bg-gray-50 rounded-lg"
                title="Buat / Bagikan link publik untuk review tanpa login"
              >
                <Share2 className="h-4 w-4 mr-1" />
                {isPublicLinkPending ? '...' : 'Bagikan link review'}
              </Button>
              <Button variant="outline" onClick={handleClose} className="h-9 px-4 border-gray-200 hover:bg-gray-50 rounded-lg">
                Close
              </Button>
              
              {/* Show approval buttons only if user has access based on configuration */}
              {canShowApprovalButtons && (
                <>
                  <Button 
                    onClick={handleApprove} 
                    disabled={isCarouselMode ? carouselCount < 1 || status === 'approved' : status === 'approved'} 
                    className="h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium px-4 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve Content
                  </Button>
                  
                  <Button 
                    onClick={handleRevision} 
                    variant="outline" 
                    className="h-9 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium px-4"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Request Revision
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};

export default GoogleDriveLinkDialog;
