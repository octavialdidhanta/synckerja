import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { MessageCircle, Send, Trash2, FileText, Globe, RotateCcw, CheckCircle, ExternalLink, CircleCheck } from 'lucide-react';
import { parseMarkdownTable, stringifyMarkdownTable, replaceTableInMarkdown } from '../utils/markdownTableUtils';
import { upsertBriefSequencesInMarkdown, stripBriefSequencesComment, type BriefSequence } from './briefSequences';
import {
  upsertBriefSceneMetaInMarkdown,
  stripBriefSceneMetaComment,
  type BriefSceneMeta,
} from './briefSceneMeta';
import { stripBriefIntroductorySentence, extractBriefTitle, removeBriefTitleFromStart, stripBreakdownScriptLabel, makeBriefSectionsInline } from '@/shared/utils/briefUtils';
import { EditableBriefTable } from './EditableBriefTable';
import { BriefStoryboardEmptyState } from './BriefStoryboardEmptyState';
import { CreateBriefTableDialog } from './CreateBriefTableDialog';
import { DEFAULT_BRIEF_STORYBOARD_HEADERS } from './briefStoryboardConstants';
import { useLinkComments } from '../hook/useLinkComments';
import { useBriefExtended } from '../hook/useBriefExtended';
import { formatDistanceToNow } from 'date-fns';
import { LinkPreviewPanel } from './LinkPreviewPanel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { validateRequiredFields } from '../container/table/cells/ValidationHelper';
import type { ContentPlan } from '../types/social-media';
import { useBriefStoryboardImages } from '../hook/useBriefStoryboardImages';

interface BriefDialogProps {
  isOpen: boolean;
  onClose: () => void;
  brief: string | null;
  onSave: (brief: string) => void;
  socialMediaPlanId?: string;
  onStatusUpdate?: (planId: string, updates: any) => void;
  targetAudience?: string | null;
  caption?: string | null;
  linkReference?: string | null;
  /** Plans list for approval validation + daily-task picker (same flow as table Approve / status Approved) */
  contentPlans?: ContentPlan[];
  /** Opens Select Daily Task when conditions match; registers pending approval in parent. Returns true if modal opened. */
  tryStartApprovalFromBrief?: (planId: string) => boolean;
}

const BriefDialog: React.FC<BriefDialogProps> = ({
  isOpen,
  onClose,
  brief,
  onSave,
  socialMediaPlanId,
  onStatusUpdate,
  targetAudience: targetAudienceProp,
  caption: captionProp,
  linkReference: linkReferenceProp,
  contentPlans,
  tryStartApprovalFromBrief,
}) => {
  const { t } = useAppTranslation();
  const [briefText, setBriefText] = useState('');
  const [targetAudienceText, setTargetAudienceText] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [linkReferenceText, setLinkReferenceText] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState<string>('brief');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showApprovalButtons, setShowApprovalButtons] = useState(false);
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [isStoryboardTableEditing, setIsStoryboardTableEditing] = useState(false);
  const skipNextAutoSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);
  const isPersistingRef = useRef(false);
  /** When true, next onOpenChange(false) must not run performSave (Save / Request Revision / Approved already persisted). */
  const skipFlushOnNextCloseRef = useRef(false);
  const prevOpenedRef = useRef<{ isOpen: boolean; socialMediaPlanId?: string }>({ isOpen: false });

  const {
    targetAudience: targetAudienceFetched,
    caption: captionFetched,
    linkReference: linkReferenceFetched,
    isLoading: extendedLoading,
    invalidate: invalidateExtended
  } = useBriefExtended(socialMediaPlanId, isOpen);

  const {
    comments,
    isLoading: commentsLoading,
    addComment,
    deleteComment
  } = useLinkComments(socialMediaPlanId || '', 'brief');
  const {
    rowImagesMap,
    uploadMany,
    remove,
    removeAllForPlan,
    insertRow,
    deleteRow,
    uploadingRowIndex,
    deletingImageId,
    isWorking: isStoryboardImagesBusy,
  } = useBriefStoryboardImages(isOpen ? socialMediaPlanId : undefined);

  // Sync form from props only when dialog first opens or when switching to another plan.
  // Do not overwrite while modal is open for the same plan (avoids refetch/realtime wiping user edits).
  useEffect(() => {
    if (!isOpen) {
      setBriefText('');
      setTargetAudienceText('');
      setCaptionText('');
      setLinkReferenceText('');
      setNewComment('');
      setShowPreview(false);
      setAccordionOpen('brief');
      setCreateTableOpen(false);
      setIsStoryboardTableEditing(false);
      prevOpenedRef.current = { isOpen: false };
      return;
    }
    const justOpened = !prevOpenedRef.current.isOpen;
    const planChanged = prevOpenedRef.current.socialMediaPlanId !== socialMediaPlanId;
    if (justOpened || planChanged) {
      setBriefText(stripBriefIntroductorySentence(brief || ''));
      setNewComment('');
      setShowPreview(false);
      setAccordionOpen('brief');
      setTargetAudienceText(targetAudienceProp !== undefined ? (targetAudienceProp ?? '') : '');
      setCaptionText(captionProp !== undefined ? (captionProp ?? '') : '');
      setLinkReferenceText(linkReferenceProp !== undefined ? (linkReferenceProp ?? '') : '');
      skipNextAutoSaveRef.current = true;
    }
    prevOpenedRef.current = { isOpen: true, socialMediaPlanId };
  }, [isOpen, socialMediaPlanId, brief, targetAudienceProp, captionProp, linkReferenceProp]);

  // When extended data finishes loading, populate target audience and caption (if not controlled by props)
  useEffect(() => {
    if (!isOpen || extendedLoading || targetAudienceProp !== undefined) return;
    setTargetAudienceText(targetAudienceFetched ?? '');
  }, [isOpen, extendedLoading, targetAudienceFetched, targetAudienceProp]);

  useEffect(() => {
    if (!isOpen || extendedLoading || captionProp !== undefined) return;
    setCaptionText(captionFetched ?? '');
  }, [isOpen, extendedLoading, captionFetched, captionProp]);

  useEffect(() => {
    if (!isOpen || extendedLoading || linkReferenceProp !== undefined) return;
    setLinkReferenceText(linkReferenceFetched ?? '');
  }, [isOpen, extendedLoading, linkReferenceFetched, linkReferenceProp]);

  useEffect(() => {
    if (isOpen) {
      skipFlushOnNextCloseRef.current = false;
      isClosingRef.current = false;
    }
  }, [isOpen]);

  // Check approval access on dialog open
  useEffect(() => {
    const checkApprovalAccess = async () => {
      if (!isOpen) return;
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setShowApprovalButtons(false);
          return;
        }

        // Get user's active organization
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile?.active_organization_id) {
          setShowApprovalButtons(false);
          return;
        }

        // Get user's role in the organization
        const { data: userRole, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', profile.active_organization_id)
          .single();

        if (roleError || !userRole) {
          setShowApprovalButtons(false);
          return;
        }

        // Get user's employee record to check exceptions
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', profile.active_organization_id)
          .single();

        if (employeeError || !employee) {
          setShowApprovalButtons(false);
          return;
        }

        // Get approval configuration for 'approved' column type
        const { data: config, error: configError } = await supabase
          .from('approval_access_configurations')
          .select('*')
          .eq('organization_id', profile.active_organization_id)
          .eq('column_type', 'approved')
          .eq('is_active', true)
          .maybeSingle();

        if (configError || !config) {
          // If no configuration found, fall back to admin-only access
          const hasAdminAccess = userRole.role === 'owner' || userRole.role === 'admin';
          setShowApprovalButtons(hasAdminAccess);
          return;
        }

        // Check if user's role is in the allowed roles
        const hasRoleAccess = config.allowed_roles?.includes(userRole.role);
        
        // Check if user is in the exceptions list
        const isException = config.exceptions?.includes(employee.id);

        setShowApprovalButtons(hasRoleAccess || isException);
      } catch (error) {
        devLog.error('Error checking approval access in BriefDialog:', error);
        setShowApprovalButtons(false);
      }
    };

    checkApprovalAccess();
  }, [isOpen]);

  const performSave = async (options: { closeAfter?: boolean; source?: string } = {}) => {
    const { closeAfter = false, source = 'unknown' } = options;
    if (isPersistingRef.current) {
      return;
    }

    isPersistingRef.current = true;
    if (!socialMediaPlanId) {
      onSave(briefText.trim());
      if (closeAfter) onClose();
      isPersistingRef.current = false;
      return;
    }

    try {
      const now = new Date().toISOString();
      const trimmedBrief = briefText.trim();
      const briefIsEmpty = trimmedBrief === '';

      if (briefIsEmpty) {
        await removeAllForPlan();
      }

      const planRowUpdate: Record<string, unknown> = briefIsEmpty
        ? {
            brief: trimmedBrief,
            status: '',
            completion_date: null,
            approved: false,
          }
        : {
            brief: trimmedBrief,
            completion_date: now,
            status: 'Need Review',
          };

      const { error: planError } = await supabase
        .from('social_media_plans')
        .update(planRowUpdate)
        .eq('id', socialMediaPlanId);

      if (planError) {
        devLog.error('Error updating brief:', planError);
        toast.error('Failed to save brief');
        return;
      }

      const { error: audienceError } = await supabase
        .from('brief_target_audiences')
        .upsert(
          {
            social_media_plan_id: socialMediaPlanId,
            description: targetAudienceText.trim() || null,
            updated_at: now
          },
          { onConflict: 'social_media_plan_id' }
        );

      if (audienceError) {
        devLog.error('Error saving target audience:', audienceError);
        toast.error('Failed to save target audience');
        return;
      }

      const { error: captionError } = await supabase
        .from('brief_captions')
        .upsert(
          {
            social_media_plan_id: socialMediaPlanId,
            content: captionText.trim() || null,
            updated_at: now
          },
          { onConflict: 'social_media_plan_id' }
        );

      if (captionError) {
        devLog.error('Error saving caption:', captionError);
        toast.error('Failed to save caption');
        return;
      }

      const { error: linkRefError } = await supabase
        .from('brief_link_references')
        .upsert(
          {
            social_media_plan_id: socialMediaPlanId,
            content: linkReferenceText.trim() || null,
            updated_at: now
          },
          { onConflict: 'social_media_plan_id' }
        );

      if (linkRefError) {
        devLog.error('Error saving link reference:', linkRefError);
        toast.error('Failed to save link reference');
        return;
      }

      invalidateExtended();
      if (onStatusUpdate) {
        onStatusUpdate(socialMediaPlanId, planRowUpdate);
      }
      if (closeAfter) {
        toast.success('Brief saved successfully');
        skipFlushOnNextCloseRef.current = true;
        onSave(trimmedBrief);
        onClose();
      }
    } catch (error) {
      devLog.error('Error in handleSave:', error);
      toast.error('Failed to save changes');
    } finally {
      isPersistingRef.current = false;
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return;
    if (skipFlushOnNextCloseRef.current) {
      skipFlushOnNextCloseRef.current = false;
      isClosingRef.current = true;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      onClose();
      return;
    }
    isClosingRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    onClose();
  };

  const handleSave = () => {
    isClosingRef.current = true;
    skipFlushOnNextCloseRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    onSave(briefText.trim());
    onClose();
    if (isPersistingRef.current) {
      return;
    }
    void performSave({ closeAfter: false, source: 'save-button-post-close' });
  };

  const handleCancel = () => {
    skipFlushOnNextCloseRef.current = true;
    isClosingRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    onClose();
  };

  // Auto-save when accordion fields change (debounced); skip first run after dialog open
  useEffect(() => {
    if (!isOpen || !socialMediaPlanId) return;
    if (isClosingRef.current) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void performSave({ closeAfter: false, source: 'autosave' });
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [isOpen, socialMediaPlanId, briefText, targetAudienceText, captionText, linkReferenceText]);

  const handleRequestRevision = async () => {
    if (!socialMediaPlanId) return;
    
    setIsUpdatingStatus(true);
    try {
      // Get current revision count
      const { data: currentPlan, error: fetchError } = await supabase
        .from('social_media_plans')
        .select('revision_count')
        .eq('id', socialMediaPlanId)
        .single();

      if (fetchError) {
        devLog.error('Error fetching current plan:', fetchError);
        toast.error('Failed to fetch current data');
        return;
      }

      const newRevisionCount = (currentPlan.revision_count || 0) + 1;

      const { error } = await supabase
        .from('social_media_plans')
        .update({
          status: 'Request Revision',
          revision_count: newRevisionCount,
          approved: false,
          completion_date: null, // Clear completion date when requesting revision
        })
        .eq('id', socialMediaPlanId);

      if (error) {
        devLog.error('Error updating status:', error);
        toast.error('Failed to request revision');
      } else {
        toast.success('Status updated to Request Revision');
        
        // Update parent component data
        if (onStatusUpdate) {
          onStatusUpdate(socialMediaPlanId, {
            status: 'Request Revision',
            revision_count: newRevisionCount,
            approved: false,
            completion_date: null // Also clear in parent update
          });
        }

        // Prevent handleDialogOpenChange from running performSave (which would reset status to Need Review)
        skipFlushOnNextCloseRef.current = true;
        onClose(); // Close popup after successful action
      }
    } catch (error) {
      devLog.error('Error in handleRequestRevision:', error);
      toast.error('Failed to request revision');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleApproved = async () => {
    if (!socialMediaPlanId) return;

    const plan = contentPlans?.find((p) => p.id === socialMediaPlanId);
    if (!plan) {
      toast.error(t('briefDialog.approvePlanNotFound', 'Content plan not found'));
      return;
    }

    const planForValidation = {
      ...plan,
      brief: briefText.trim() || plan.brief || '',
    };
    const missingFields = validateRequiredFields(planForValidation);
    if (missingFields.length > 0) {
      toast.error(
        t('briefDialog.approveMissingFields', 'Cannot approve content. Please fill: {{fields}}', {
          fields: missingFields.join(', '),
        }),
      );
      return;
    }

    if (tryStartApprovalFromBrief?.(socialMediaPlanId)) {
      skipFlushOnNextCloseRef.current = true;
      onClose();
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const completionDate = new Date().toISOString();

      const { error } = await supabase
        .from('social_media_plans')
        .update({
          status: 'Approved',
          approved: true,
          completion_date: completionDate,
        })
        .eq('id', socialMediaPlanId);

      if (error) {
        devLog.error('Error updating status:', error);
        toast.error(t('briefDialog.approveFailed', 'Failed to approve'));
      } else {
        toast.success(t('briefDialog.approveSuccess', 'Status updated to Approved'));

        if (onStatusUpdate) {
          onStatusUpdate(socialMediaPlanId, {
            status: 'Approved',
            approved: true,
            completion_date: completionDate,
          });
        }

        skipFlushOnNextCloseRef.current = true;
        onClose();
      }
    } catch (error) {
      devLog.error('Error in handleApproved:', error);
      toast.error(t('briefDialog.approveFailed', 'Failed to approve'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const parsedTable = useMemo(() => parseMarkdownTable(briefText), [briefText]);
  const briefTitle = useMemo(
    () =>
      extractBriefTitle(
        stripBriefSceneMetaComment(stripBriefSequencesComment(briefText)),
      ),
    [briefText],
  );
  const briefProseBeforeTable = useMemo(() => {
    if (!parsedTable || parsedTable.startIndex <= 0) return '';
    return makeBriefSectionsInline(
      stripBreakdownScriptLabel(
        removeBriefTitleFromStart(
          stripBriefSceneMetaComment(
            stripBriefSequencesComment(briefText.slice(0, parsedTable.startIndex)),
          ),
        ),
      ),
    ).trim();
  }, [briefText, parsedTable]);
  const briefProseAfterTable = useMemo(() => {
    if (!parsedTable || parsedTable.endIndex >= briefText.length) return '';
    return stripBriefSceneMetaComment(stripBriefSequencesComment(briefText.slice(parsedTable.endIndex))).trim();
  }, [briefText, parsedTable]);

  const normalizeTableDataForSave = (
    newTableData: string[][],
    existingTable: { table: string[][] } | null,
  ): string[][] => {
    const firstCell = newTableData[0]?.[0]?.trim() ?? '';
    const isFirstRowData = /^\d+-\d+s$/i.test(firstCell) || /^\d+-\d+\s*s$/i.test(firstCell);
    if (!isFirstRowData || newTableData.length === 0) return newTableData;

    const originalHeader = existingTable?.table[0];
    const headerRow =
      originalHeader && !/^\d+-\d+s$/i.test((originalHeader[0] ?? '').trim())
        ? originalHeader
        : [...DEFAULT_BRIEF_STORYBOARD_HEADERS];
    const colCount = Math.max(headerRow.length, ...newTableData.map((r) => r.length));
    const pad = (arr: string[]) => {
      const a = [...arr];
      while (a.length < colCount) a.push('');
      return a.slice(0, colCount);
    };
    return [pad(headerRow), ...newTableData.map(pad)];
  };

  const applyTableToBrief = (
    brief: string,
    newTableData: string[][],
    existingParsedTable: ReturnType<typeof parseMarkdownTable>,
  ): string => {
    const dataToSave = normalizeTableDataForSave(newTableData, existingParsedTable);
    const newTableMarkdown = stringifyMarkdownTable(dataToSave, {
      trimTrailingEmptyBodyRows: false,
    });
    if (existingParsedTable) {
      return replaceTableInMarkdown(
        brief,
        newTableMarkdown,
        existingParsedTable.startIndex,
        existingParsedTable.endIndex,
      );
    }
    const trimmed = brief.trim();
    if (!trimmed) return newTableMarkdown;
    return `${trimmed}\n\n${newTableMarkdown}`;
  };

  const handleTableSave = (
    newTableData: string[][],
    meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
  ) => {
    setBriefText((prev) => {
      let next = applyTableToBrief(prev, newTableData, parseMarkdownTable(prev));
      if (meta?.sequences) {
        next = upsertBriefSequencesInMarkdown(next, meta.sequences);
      }
      if (meta?.sceneMeta) {
        next = upsertBriefSceneMetaInMarkdown(next, meta.sceneMeta);
      }
      return next;
    });
  };

  const handleCreateStoryboardTable = (tableData: string[][]) => {
    setBriefText((prev) => applyTableToBrief(prev, tableData, null));
    setCreateTableOpen(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !socialMediaPlanId) return;
    
    await addComment({ commentText: newComment.trim() });
    setNewComment('');
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId);
  };

  // ReactMarkdown components — padat agar table utama dapat lebih banyak ruang
  const briefMarkdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-base font-semibold text-gray-900 mt-1 mb-0.5 first:mt-0 pb-0.5 border-b border-gray-100">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-sm font-semibold text-gray-900 mt-1 mb-0.5 first:mt-0 pb-0.5">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-semibold text-gray-800 mt-1 mb-0.5 first:mt-0 pb-0.5">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="my-0.5 text-gray-700 leading-snug text-sm">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="my-0.5 ml-4 list-disc space-y-0.5 text-gray-700 text-sm">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="my-0.5 ml-4 list-decimal space-y-0.5 text-gray-700 text-sm">{children}</ol>
    ),
    hr: () => <hr className="my-1 border-t border-dashed border-gray-200" />,
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="my-0.5 pl-3 border-l-2 border-gray-300 text-gray-600 italic text-sm">{children}</blockquote>
    ),
  };

  // Check if brief contains Google Docs links
  const hasGoogleDocsLink = briefText.includes('docs.google.com');

  // Extract first URL from link reference text for "View reference" button
  const firstLinkReferenceUrl = (() => {
    const match = linkReferenceText.match(/https?:\/\/[^\s]+/i);
    return match ? match[0].replace(/[.,;:!?)]+$/, '') : null;
  })();

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        hideCloseButton
        fullscreenAnimation
        className="fixed left-0 right-0 top-0 z-50 flex h-dvh max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-none sm:rounded-none"
      >
        <DialogTitle className="sr-only absolute">Content Brief</DialogTitle>
        <DialogDescription className="sr-only absolute">Edit content brief and manage comments</DialogDescription>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Section - Comments (Fixed width agar tidak berubah saat klik Approved/checklist) */}
            <div className="w-96 flex-shrink-0 max-lg:hidden border-r border-gray-200 flex flex-col min-h-0">
              <div className="flex h-12 shrink-0 items-center border-b border-gray-100 bg-gray-50 px-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-sm text-gray-800">Comments</span>
                </div>
              </div>

              {socialMediaPlanId && (
                <>
                  {/* Comments List */}
                  <div className="flex-1 overflow-y-auto seamless-scroll p-4">
                    {commentsLoading ? (
                      <div className="text-sm text-gray-500">Loading comments...</div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <div className="text-sm text-gray-500">No comments yet</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div key={comment.id} className="bg-white border border-gray-200 p-3 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-blue-600">
                                    {comment.creator?.full_name?.charAt(0) || 'U'}
                                  </span>
                                </div>
                                <span className="font-medium text-sm text-gray-800">
                                  {comment.creator?.full_name || 'Unknown User'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700">{comment.comment_text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Comment Field - Moved to Bottom */}
                  <div className="p-4 border-t border-gray-100 flex-shrink-0 min-w-0 overflow-hidden">
                    <div className="flex gap-2 min-w-0">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="min-h-[60px] resize-none text-sm flex-1 min-w-0"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        size="sm"
                        className="self-end px-3"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Section - Brief Content & Preview: full height dengan batas max-h, table punya batas tinggi dan bisa di-scroll */}
            <div className="flex-1 min-w-0 max-lg:w-full flex flex-col min-h-0 overflow-hidden">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50 px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-gray-600" />
                  <span className="shrink-0 font-medium text-sm text-gray-800">
                    {t('briefDialog.sectionBriefContent', 'Brief Content')}
                  </span>
                  {briefTitle ? (
                    <span className="min-w-0 truncate text-sm font-semibold text-gray-900" title={briefTitle}>
                      {' - '}{briefTitle}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {hasGoogleDocsLink && (
                    <div className="flex gap-1">
                      <Button
                        variant={!showPreview ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowPreview(false)}
                        className="h-7 px-3 text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {t('briefDialog.edit', 'Edit')}
                      </Button>
                      <Button
                        variant={showPreview ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowPreview(true)}
                        className="h-7 px-3 text-xs"
                      >
                        <Globe className="h-3 w-3 mr-1" />
                        {t('briefDialog.preview', 'Preview')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {showPreview && hasGoogleDocsLink ? (
                  <LinkPreviewPanel brief={briefText} />
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 py-2">
                    <Accordion
                      type="single"
                      collapsible
                      value={accordionOpen}
                      onValueChange={(v) => setAccordionOpen(v ?? '')}
                      className="w-full flex-1 flex flex-col min-h-0 gap-1 overflow-y-auto overflow-x-hidden seamless-scroll"
                    >
                      <AccordionItem value="brief" className="border border-gray-200 rounded-lg px-4 bg-white flex flex-col flex-shrink-0 data-[state=open]:flex-1 data-[state=open]:min-h-[calc(100dvh-10rem)]">
                        <AccordionTrigger className="flex-shrink-0 py-3 text-sm font-medium text-gray-800 hover:no-underline [&>svg]:ml-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
                            {briefText.trim() ? (
                              <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" aria-hidden />
                            )}
                            <span className="min-w-0 truncate text-left whitespace-nowrap">
                              {t('briefDialog.sectionBriefContent', 'Brief Content')}
                              {briefTitle ? (
                                <span className="font-semibold text-gray-900">{` - ${briefTitle}`}</span>
                              ) : null}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent
                          primitiveClassName="data-[state=open]:!flex-1 data-[state=open]:!min-h-0"
                          className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4 pt-0 data-[state=open]:flex data-[state=open]:min-h-0 data-[state=open]:flex-1"
                        >
                          <div
                            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain max-h-[calc(100dvh-12rem)]"
                            style={{ overflowAnchor: 'none' } as React.CSSProperties}
                          >
                            {parsedTable ? (
                              <>
                                {briefProseBeforeTable ? (
                                  <div className="prose prose-sm max-w-none mb-1 prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5 prose-ul:my-0.5 prose-ol:my-0.5 flex-shrink-0">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={briefMarkdownComponents}
                                    >
                                      {briefProseBeforeTable}
                                    </ReactMarkdown>
                                  </div>
                                ) : null}
                                <div className="flex min-h-0 flex-1 flex-shrink-0 flex-col">
                                <EditableBriefTable
                                  tableData={parsedTable.table}
                                  onSave={handleTableSave}
                                  storyboardToolbar
                                  sequencesSource={briefText}
                                  onEditingChange={setIsStoryboardTableEditing}
                                  planId={socialMediaPlanId}
                                  rowImagesMap={rowImagesMap}
                                  onUploadImages={uploadMany}
                                  onDeleteImage={remove}
                                  onInsertRowImages={insertRow}
                                  onDeleteRowImages={deleteRow}
                                  mediaBusy={isStoryboardImagesBusy}
                                  uploadingRowIndex={uploadingRowIndex}
                                  deletingImageId={deletingImageId}
                                  className="!my-1"
                                />
                                </div>
                                {briefProseAfterTable ? (
                                  <div className="prose prose-sm max-w-none mt-1 flex-shrink-0 prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={briefMarkdownComponents}
                                    >
                                      {briefProseAfterTable}
                                    </ReactMarkdown>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {stripBriefSceneMetaComment(stripBriefSequencesComment(briefText)).trim() ? (
                                  <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={briefMarkdownComponents}
                                    >
                                      {makeBriefSectionsInline(
                                        stripBreakdownScriptLabel(
                                          removeBriefTitleFromStart(
                                            stripBriefSceneMetaComment(stripBriefSequencesComment(briefText)),
                                          ),
                                        ),
                                      )}
                                    </ReactMarkdown>
                                  </div>
                                ) : null}
                                <BriefStoryboardEmptyState
                                  onCreateTable={() => setCreateTableOpen(true)}
                                />
                              </>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="targetAudience" className="border border-gray-200 rounded-lg px-4 bg-white flex flex-col data-[state=open]:flex-1 data-[state=open]:min-h-0">
                        <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline py-3 flex-shrink-0">
                          <span className="flex items-center gap-2">
                            {targetAudienceText.trim() ? (
                              <CircleCheck className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                            ) : (
                              <span className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300" aria-hidden />
                            )}
                            {t('briefDialog.sectionTargetAudience', 'Concept')}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent
                          primitiveClassName="data-[state=open]:!h-full"
                          className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4 pt-0 min-h-[280px] h-full"
                        >
                          <div className="min-h-[260px] flex-1 flex flex-col overflow-hidden h-full">
                            <Textarea
                              value={targetAudienceText}
                              onChange={(e) => setTargetAudienceText(e.target.value)}
                              placeholder={t('briefDialog.placeholderTargetAudience', 'Target audience description (free-form)...')}
                              className="w-full h-full min-h-[240px] resize-none border-gray-200 text-sm"
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="caption" className="border border-gray-200 rounded-lg px-4 bg-white flex flex-col data-[state=open]:flex-1 data-[state=open]:min-h-0">
                        <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline py-3 flex-shrink-0">
                          <span className="flex items-center gap-2">
                            {captionText.trim() ? (
                              <CircleCheck className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                            ) : (
                              <span className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300" aria-hidden />
                            )}
                            {t('briefDialog.sectionCaption', 'Caption')}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent
                          primitiveClassName="data-[state=open]:!h-full"
                          className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4 pt-0 min-h-[280px] h-full"
                        >
                          <div className="min-h-[260px] flex-1 flex flex-col overflow-hidden h-full">
                            <Textarea
                              value={captionText}
                              onChange={(e) => setCaptionText(e.target.value)}
                              placeholder={t('briefDialog.placeholderCaption', 'Caption and hashtags...')}
                              className="w-full h-full min-h-[240px] resize-none border-gray-200 text-sm"
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="linkReference" className="border border-gray-200 rounded-lg px-4 bg-white flex flex-col data-[state=open]:flex-1 data-[state=open]:min-h-0">
                        <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline py-3 flex-shrink-0">
                          <span className="flex items-center gap-2">
                            {linkReferenceText.trim() ? (
                              <CircleCheck className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
                            ) : (
                              <span className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300" aria-hidden />
                            )}
                            {t('briefDialog.sectionLinkReference', 'Link Reference')}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent
                          primitiveClassName="data-[state=open]:!h-full"
                          className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4 pt-0 min-h-[280px] h-full"
                        >
                          <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
                            <div className="flex-shrink-0 mb-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!firstLinkReferenceUrl}
                                onClick={() => firstLinkReferenceUrl && window.open(firstLinkReferenceUrl, '_blank', 'noopener,noreferrer')}
                                className="gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {t('briefDialog.viewLinkReference', 'View reference video')}
                              </Button>
                            </div>
                            <div className="min-h-[260px] flex-1 flex flex-col overflow-hidden">
                              <Textarea
                                value={linkReferenceText}
                                onChange={(e) => setLinkReferenceText(e.target.value)}
                                placeholder={t('briefDialog.placeholderLinkReference', 'Paste link(s) or reference URL(s)...')}
                                className="w-full h-full min-h-[240px] resize-none border-gray-200 text-sm"
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0 bg-gray-50">
            {/* Left side - Action buttons */}
            <div className="flex gap-2">
              {socialMediaPlanId && showApprovalButtons && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestRevision}
                    disabled={isUpdatingStatus || isStoryboardImagesBusy}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('briefDialog.requestRevision', 'Request Revision')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApproved}
                    disabled={isUpdatingStatus || isStoryboardImagesBusy}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('briefDialog.approved', 'Approved')}
                  </Button>
                </>
              )}
            </div>

            {/* Right side - Cancel and Save buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isStoryboardTableEditing || isStoryboardImagesBusy}
                className="px-6"
              >
                {t('briefDialog.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleSave} disabled={isStoryboardTableEditing || isStoryboardImagesBusy} className="px-6">
                {t('briefDialog.saveBrief', 'Save Brief')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <CreateBriefTableDialog
      open={createTableOpen}
      onOpenChange={setCreateTableOpen}
      onCreate={handleCreateStoryboardTable}
    />
    </>
  );
};

export default BriefDialog;
