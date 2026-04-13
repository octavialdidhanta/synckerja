import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { CheckSquare, Square, Edit, Trash2, GripVertical, Paperclip, Upload, FileText, X, Users, Link, History, Plus, ListChecks, FileEdit } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { useDailyTask } from '../context/DailyTaskContext';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AssignStepDialog } from './AssignStepDialog';
import { StepLinks } from './StepLinks';
import { StepHistoryModal } from './StepHistoryModal';
import { ModalViewSubSteps } from './ModalViewSubSteps';
import { ModalAddTaskStep } from './ModalAddTaskStep';
import UpdateHistoryDialog from '@/8-1-meeting-notes/modal/UpdateHistoryDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { TaskStep as TaskStepData } from '../types/taskTypes';
import { getStepCheckboxRule } from '../utils/stepCheckboxRules';
import { LINK_REMOVED_FROM_PREVIEW_REJECT_REASON } from '../services/completionApprovalService';

/** Smooth transition when step settles after reorder drop */
const SORT_DROP_TRANSITION = 'transform 0.38s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s ease-out';

interface TaskFile {
  id: string;
  task_steps_id: string;
  filename: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

interface TaskLink {
  id: string;
  task_steps_id: string;
  title: string;
  url: string;
  created_at: string;
}

/** Row shape for meeting_point_solutions (Supabase type may not infer). */
interface MeetingPointSolutionRow {
  id: string;
  meeting_point_id: string;
  solution_description?: string | null;
}

/** Row shape for meeting_points (Supabase type may not infer). */
interface MeetingPointRow {
  id: string;
  discussion_point?: string | null;
  organization_id: string;
}

/** Row shape for social_media_plans (Supabase type may not infer). */
interface SocialMediaPlanRow {
  approved?: boolean | null;
  google_drive_link?: string | null;
  production_approved?: boolean | null;
}

interface TaskStepProps {
  step: TaskStepData;
  index: number;
  taskCreatedBy?: string; // Task creator user ID for permission check
  taskTitle?: string; // Task title for modal display
  autoReorder?: boolean; // Enable auto-reorder when step completion changes (for mobile)
  /** When provided, swipe-to-reveal actions on mobile (icons in strip, close by swiping right) */
  isRevealed?: boolean;
  onReveal?: () => void;
  onClose?: () => void;
  /** When true, only row content is rendered (no swipe, no action buttons). Used by mobile wrapper. */
  contentOnly?: boolean;
  /** Called when the Sub Step modal opens or closes. Used by parent (e.g. TaskDetailModal) to block back from closing the wrong dialog. */
  onSubStepModalOpenChange?: (open: boolean) => void;
  /** When this value changes, close the Sub Step modal (used when parent receives back and wants to close inner modal first). */
  closeSubStepRequested?: number;
  /** When provided with contentOnly, parent (e.g. MobileTaskStep) owns the sortable node; only grip drag handle is used. */
  sortableHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}

export interface TaskStepHandle {
  openEdit: () => void;
  openDelete: () => void;
  openAssign: () => void;
  openHistory: () => void;
  openSubSteps: () => void;
  toggleFiles: () => void;
  toggleLinks: () => void;
  openUpdateHistory: () => void;
}

export const TaskStep = forwardRef<TaskStepHandle, TaskStepProps>(function TaskStep(
  props,
  ref
) {
  const { contentOnly = false, sortableHandleProps } = props;
  if (contentOnly && sortableHandleProps) {
    return <TaskStepContentOnly ref={ref} {...props} />;
  }
  return <TaskStepWithSortable ref={ref} {...props} />;
});

/** Renders step when parent owns the sortable node; no useSortable, grip uses sortableHandleProps. */
const TaskStepContentOnly = forwardRef<TaskStepHandle, TaskStepProps>(function TaskStepContentOnly(
  props,
  ref
) {
  const { sortableHandleProps } = props;
  return (
    <TaskStepInner
      ref={ref}
      {...props}
      sortableHandleProps={sortableHandleProps!}
    />
  );
});

/** Calls useSortable and passes result to TaskStepInner. */
const TaskStepWithSortable = forwardRef<TaskStepHandle, TaskStepProps>(function TaskStepWithSortable(
  props,
  ref
) {
  const { step } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${step.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition || SORT_DROP_TRANSITION),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <TaskStepInner
      ref={ref}
      {...props}
      sortableNodeRef={setNodeRef}
      sortableNodeStyle={style}
      sortableHandleAttributes={attributes}
      sortableHandleListeners={listeners}
      sortableIsDragging={isDragging}
    />
  );
});

type TaskStepInnerProps = TaskStepProps & {
  sortableHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
  sortableNodeRef?: (node: HTMLElement | null) => void;
  sortableNodeStyle?: React.CSSProperties;
  sortableHandleAttributes?: Record<string, unknown>;
  sortableHandleListeners?: Record<string, unknown>;
  sortableIsDragging?: boolean;
};

const TaskStepInner = forwardRef<TaskStepHandle, TaskStepInnerProps>(function TaskStepInner(
  { step, index, taskCreatedBy, taskTitle = '', autoReorder = false, isRevealed = false, onReveal, onClose, contentOnly = false, onSubStepModalOpenChange, closeSubStepRequested, sortableHandleProps, sortableNodeRef, sortableNodeStyle, sortableHandleAttributes, sortableHandleListeners, sortableIsDragging },
  ref
) {
  const handleAttrs = sortableHandleProps ? sortableHandleProps.attributes : (sortableHandleAttributes ?? {});
  const handleListeners = sortableHandleProps ? sortableHandleProps.listeners : (sortableHandleListeners ?? {});
  const nodeRef = sortableHandleProps ? undefined : sortableNodeRef;
  const nodeStyle = sortableHandleProps ? undefined : sortableNodeStyle;

  const { updateTaskStep, deleteTaskStep, uploadTaskStepFile, deleteTaskFile, assignTaskStep, rejectedReasonsByStepId, highlightFromPendingApproval, pendingApprovalFocus, setPendingApprovalFocus } = useDailyTask();
  const isHighlightedFromPendingApproval = Boolean(highlightFromPendingApproval && pendingApprovalFocus?.stepId === step.id);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showFiles, setShowFiles] = useState(false); // Default collapsed
  const [showLinks, setShowLinks] = useState(false);
  const [isDescriptionPopoverOpen, setIsDescriptionPopoverOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isViewSubStepsOpen, setIsViewSubStepsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  /** Mobile expandable card: collapse = title + description one line each; tap content to expand; auto-collapse after 5s */
  const isMobileExpandableCard = Boolean(contentOnly && isMobile);
  const [cardExpanded, setCardExpanded] = useState(false);
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onSubStepModalOpenChange?.(isViewSubStepsOpen);
  }, [isViewSubStepsOpen, onSubStepModalOpenChange]);
  useEffect(() => {
    if (closeSubStepRequested != null && closeSubStepRequested > 0 && isViewSubStepsOpen) {
      onSubStepModalOpenChange?.(false);
      setIsViewSubStepsOpen(false);
    }
  }, [closeSubStepRequested, isViewSubStepsOpen, onSubStepModalOpenChange]);

  /** Auto-collapse mobile expandable card after 5s when expanded */
  useEffect(() => {
    if (!isMobileExpandableCard || !cardExpanded) {
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
        autoCollapseTimerRef.current = null;
      }
      return;
    }
    autoCollapseTimerRef.current = setTimeout(() => {
      setCardExpanded(false);
      autoCollapseTimerRef.current = null;
    }, 5000);
    return () => {
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
        autoCollapseTimerRef.current = null;
      }
    };
  }, [isMobileExpandableCard, cardExpanded]);

  // Open sub-step modal when pending approval
  useEffect(() => {
    if (pendingApprovalFocus?.openSubStepModalForStepId === step.id) {
      onSubStepModalOpenChange?.(true);
      setIsViewSubStepsOpen(true);
      setPendingApprovalFocus(pendingApprovalFocus ? { ...pendingApprovalFocus, openSubStepModalForStepId: undefined } : null);
    }
  }, [pendingApprovalFocus?.openSubStepModalForStepId, pendingApprovalFocus, step.id, setPendingApprovalFocus, onSubStepModalOpenChange]);
  const [subStepCount, setSubStepCount] = useState<number>(0);
  const [subStepCompletedCount, setSubStepCompletedCount] = useState<number>(0);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [linkCount, setLinkCount] = useState<number>(0);
  // Optimistic update state for immediate UI feedback
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean | null>(null);
  const [optimisticUpdatedAt, setOptimisticUpdatedAt] = useState<string | null>(null);
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { t } = useAppTranslation();

  // States for meeting point integration
  const [isFromMeetingPoint, setIsFromMeetingPoint] = useState(false);
  const [solutionId, setSolutionId] = useState<string | null>(null);
  const [meetingPointId, setMeetingPointId] = useState<string | null>(null);
  const [discussionPoint, setDiscussionPoint] = useState<string>('');
  const [isUpdateHistoryOpen, setIsUpdateHistoryOpen] = useState(false);
  const [isCheckingMeetingPoint, setIsCheckingMeetingPoint] = useState(false);
  const [updateHistoryCount, setUpdateHistoryCount] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCompletionState, setPendingCompletionState] = useState<boolean | null>(null);
  const [currentCompletionState, setCurrentCompletionState] = useState<boolean | null>(null);
  const [deleteStepDialogOpen, setDeleteStepDialogOpen] = useState(false);

  // Use optimistic state if available, otherwise use step prop (for immediate UI feedback)
  const isCompleted = optimisticCompleted !== null ? optimisticCompleted : step.is_completed;
  const stepCheckboxRule = getStepCheckboxRule({
    isCompleted,
    subStepCount,
    subStepCompletedCount,
  });
  const rawRejectReason = rejectedReasonsByStepId[step.id];
  const stepRejectReason =
    rawRejectReason &&
    !(rawRejectReason === LINK_REMOVED_FROM_PREVIEW_REJECT_REASON && stepCheckboxRule.isChecked)
      ? rawRejectReason
      : undefined;
  const updatedAt = optimisticUpdatedAt !== null ? optimisticUpdatedAt : step.updated_at;
  
  // Use completed_at for finished date (from task_steps table)
  // completed_at is automatically set by database trigger when is_completed = TRUE
  const completedAt = step.completed_at;

  // Check if current user is the creator of the task
  const isTaskCreator = taskCreatedBy === user?.id;

  // Check if current user is the creator of this step
  const isStepCreator = step.created_by === user?.id;

  // Check if current user is assigned to this step
  const isAssignedToMe = step.assigned_to === user?.id;

  // Permission: Creator can do everything, assigned user can only complete
  const canEdit = isTaskCreator;
  const canDelete = isTaskCreator;
  const canAssign = isTaskCreator;

  // Check if step has notifications (files)
  const fileCount = step.files?.length || 0;

  const hasSwipe = (onReveal != null && onClose != null) && !contentOnly;
  const ACTION_STRIP_WIDTH = 140;
  const SWIPE_THRESHOLD = 28;
  const DIRECTION_LOCK_PX = 8;
  const [translateX, setTranslateX] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
  } | null>(null);
  const translateXRef = useRef(0);
  const slidingRowRef = useRef<HTMLDivElement>(null);
  const lockHorizontalRef = useRef(false);

  translateXRef.current = translateX;
  lockHorizontalRef.current = touchStartRef.current?.lockHorizontal === true;

  useImperativeHandle(ref, () => ({
    openEdit: () => setIsEditModalOpen(true),
    openDelete: () => setDeleteStepDialogOpen(true),
    openAssign: () => setShowAssignDialog(true),
    openHistory: () => setShowHistoryModal(true),
    openSubSteps: () => {
      onSubStepModalOpenChange?.(true);
      setIsViewSubStepsOpen(true);
    },
    toggleFiles: () => setShowFiles((f) => !f),
    toggleLinks: () => setShowLinks((l) => !l),
    openUpdateHistory: () => setIsUpdateHistoryOpen(true),
  }), []);

  useEffect(() => {
    if (!hasSwipe || !slidingRowRef.current) return;
    const el = slidingRowRef.current;
    const onMove = (e: TouchEvent) => {
      if (lockHorizontalRef.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [hasSwipe]);

  useEffect(() => {
    if (hasSwipe && !isRevealed && translateX !== 0) setTranslateX(0);
  }, [hasSwipe, isRevealed, translateX]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasSwipe) return;
    setIsSwipeDragging(true);
    touchStartRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTranslateX: translateX, lockHorizontal: null };
    const el = slidingRowRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${translateX}px)`;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!hasSwipe || !start) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - start.startX;
    const deltaY = currentY - start.startY;
    if (start.lockHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
        start.lockHorizontal = absX >= absY;
        lockHorizontalRef.current = start.lockHorizontal;
      }
    }
    if (start.lockHorizontal === true) {
      const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
      translateXRef.current = next;
      const el = slidingRowRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!hasSwipe) return;
    setIsSwipeDragging(false);
    lockHorizontalRef.current = false;
    touchStartRef.current = null;
    const el = slidingRowRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
    const current = translateXRef.current;
    if (current < -SWIPE_THRESHOLD) {
      setTranslateX(-ACTION_STRIP_WIDTH);
      onReveal?.();
    } else {
      setTranslateX(0);
      onClose?.();
    }
  };

  // Removed auto-expand effect - files section now defaults to collapsed

  // Compute on-time/late label for finished step vs due date
  // Use completed_at from task_steps table (automatically set by database trigger)
  const getFinishStatusLabel = (): { text: string; className: string } | null => {
    if (!step.assigned_due_date || !isCompleted) return null;
    
    // Use completed_at from task_steps table for finished date
    // completed_at is automatically set by database trigger when is_completed = TRUE
    const finishDate = step.completed_at;
    if (!finishDate) return null;
    
    const assigneeName = step.assigned_employee?.full_name || 'Assignee';
    const finish = new Date(finishDate);
    const dueEnd = new Date(step.assigned_due_date);
    // on time means finish is on/before 23:59:59 of due date
    dueEnd.setHours(23, 59, 59, 999);
    if (finish.getTime() <= dueEnd.getTime()) {
      return { text: contentOnly ? 'Ontime' : `${assigneeName} ontime`, className: 'text-[10px] text-green-600' };
    }
    const diffMs = finish.getTime() - dueEnd.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const lateDays = Math.ceil(diffMs / dayMs);
    const lateText = contentOnly
      ? `Late ${lateDays} day${lateDays > 1 ? 's' : ''}`
      : `${assigneeName} late ${lateDays} day${lateDays > 1 ? 's' : ''}`;
    return { text: lateText, className: 'text-[10px] text-red-600' };
  };

  // Compute overdue days label for active (not completed) steps
  const getOverdueLabel = (): { text: string; className: string } | null => {
    if (!step.assigned_due_date || isCompleted) return null;
    const now = new Date();
    const dueEnd = new Date(step.assigned_due_date);
    // consider overdue if now is after 23:59:59 on due date
    dueEnd.setHours(23, 59, 59, 999);
    if (now.getTime() <= dueEnd.getTime()) return null;
    const diffMs = now.getTime() - dueEnd.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const overdueDays = Math.ceil(diffMs / dayMs);
    return {
      text: `Overdue ${overdueDays} day${overdueDays > 1 ? 's' : ''}`,
      className: 'text-[10px] text-red-600',
    };
  };

  // Load history count and link count for badges
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Fetch history count using RPC
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Count timeout')), 3000)
        );

        const countPromise = (supabase as any).rpc('get_step_history_count', {
          p_task_step_id: step.id
        });

        const { data: count, error } = await Promise.race([
          countPromise,
          timeoutPromise
        ]) as any;
        
        if (!error) {
          setHistoryCount(count || 0);
        } else {
          setHistoryCount(0);
        }
        
        // Fetch link count from task_step_links table
        const { count: linksCount, error: linksError } = await supabase
          .from('task_step_links')
          .select('*', { count: 'exact', head: true })
          .eq('task_step_id', step.id);
        
        if (!linksError) {
          setLinkCount(linksCount || 0);
        }
      } catch (error: any) {
        // Graceful degradation for timeout or other errors
        setHistoryCount(0);
      }
    };

    fetchCounts();
  }, [step.id]);

  // Load sub-steps stats (total and completed)
  useEffect(() => {
    const fetchSubStepStats = async () => {
      if (!organizationId) return;
      try {
        const [{ count: totalCount }, { count: completedCount }] = await Promise.all([
          supabase
            .from('task_steps_to_steps')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('parent_step_id', step.id),
          supabase
            .from('task_steps_to_steps')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('parent_step_id', step.id)
            .eq('is_completed', true),
        ]);
        setSubStepCount(totalCount || 0);
        setSubStepCompletedCount(completedCount || 0);
      } catch (err) {
        // ignore
      }
    };
    fetchSubStepStats();
  }, [organizationId, step.id]);

  // Refresh stats when closing sub-steps modal
  useEffect(() => {
    if (!isViewSubStepsOpen) {
      (async () => {
        if (!organizationId) return;
        try {
          const [{ count: totalCount }, { count: completedCount }] = await Promise.all([
            supabase
              .from('task_steps_to_steps')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', organizationId)
              .eq('parent_step_id', step.id),
            supabase
              .from('task_steps_to_steps')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', organizationId)
              .eq('parent_step_id', step.id)
              .eq('is_completed', true),
          ]);
          setSubStepCount(totalCount || 0);
          setSubStepCompletedCount(completedCount || 0);
        } catch (_) {
          // ignore
        }
      })();
    }
  }, [isViewSubStepsOpen, organizationId, step.id]);

  // Check if step is from meeting point
  useEffect(() => {
    const checkIfFromMeetingPoint = async () => {
      if (!organizationId || !step.title) {
        setIsFromMeetingPoint(false);
        return;
      }

      setIsCheckingMeetingPoint(true);
      try {
        // First, query solution with solution_description that matches step.title
        const { data: solutionRaw, error: solutionError } = await supabase
          .from('meeting_point_solutions')
          .select('id, meeting_point_id, solution_description')
          .eq('solution_description', step.title)
          .maybeSingle();
        const solution = solutionRaw as unknown as MeetingPointSolutionRow | null;

        if (solutionError) {
          console.error('Error checking meeting point solution:', solutionError);
          setIsFromMeetingPoint(false);
          return;
        }

        if (!solution || !solution.meeting_point_id) {
          setIsFromMeetingPoint(false);
          return;
        }

        // Found solution - now verify it belongs to current organization
        const { data: meetingPointRaw, error: meetingPointError } = await supabase
          .from('meeting_points')
          .select('id, discussion_point, organization_id')
          .eq('id', solution.meeting_point_id)
          .eq('organization_id', organizationId)
          .maybeSingle();
        const meetingPoint = meetingPointRaw as unknown as MeetingPointRow | null;

        if (meetingPointError) {
          console.error('Error checking meeting point:', meetingPointError);
          setIsFromMeetingPoint(false);
          return;
        }

        if (meetingPoint && meetingPoint.organization_id === organizationId) {
          // Step is from meeting point - set all required data
          console.log('âœ… Step is from meeting point:', {
            stepTitle: step.title,
            solutionId: solution.id,
            meetingPointId: solution.meeting_point_id,
            discussionPoint: meetingPoint.discussion_point
          });
          setIsFromMeetingPoint(true);
          setSolutionId(solution.id);
          setMeetingPointId(solution.meeting_point_id);
          setDiscussionPoint(meetingPoint.discussion_point || '');
        } else {
          setIsFromMeetingPoint(false);
        }
      } catch (error) {
        console.error('Error checking meeting point:', error);
        setIsFromMeetingPoint(false);
      } finally {
        setIsCheckingMeetingPoint(false);
      }
    };

    checkIfFromMeetingPoint();
  }, [step.title, organizationId]);

  // Fetch update history count for solution
  useEffect(() => {
    const fetchUpdateCount = async () => {
      if (!solutionId || !isFromMeetingPoint) {
        setUpdateHistoryCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('meeting_point_updates')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_point_solution_id', solutionId);

        if (error) {
          console.error('Error fetching update count:', error);
          setUpdateHistoryCount(0);
          return;
        }

        setUpdateHistoryCount(count || 0);
      } catch (error) {
        console.error('Error fetching update count:', error);
        setUpdateHistoryCount(0);
      }
    };

    fetchUpdateCount();
  }, [solutionId, isFromMeetingPoint]);

  // Refresh update count when dialog closes (in case updates were added/removed)
  useEffect(() => {
    if (!isUpdateHistoryOpen && solutionId && isFromMeetingPoint) {
      const fetchUpdateCount = async () => {
        try {
          const { count, error } = await supabase
            .from('meeting_point_updates')
            .select('*', { count: 'exact', head: true })
            .eq('meeting_point_solution_id', solutionId);

          if (!error) {
            setUpdateHistoryCount(count || 0);
          }
        } catch (error) {
          console.error('Error refreshing update count:', error);
        }
      };

      fetchUpdateCount();
    }
  }, [isUpdateHistoryOpen, solutionId, isFromMeetingPoint]);

  // Auto-complete Concept step when approved = true
  useEffect(() => {
    const autoCompleteConceptStep = async () => {
      // Only check for Concept step with social_media_plan_id and no sub-steps
      if (!step.social_media_plan_id || subStepCount > 0) return;
      
      // Use is_concept_step column instead of parsing title
      const isConceptStep = step.is_concept_step === true;
      if (!isConceptStep) return;

      // Skip if already completed
      if (step.is_completed) return;

      try {
        const { data: planDataRaw, error: planError } = await supabase
          .from('social_media_plans')
          .select('approved')
          .eq('id', step.social_media_plan_id)
          .single();
        const planData = planDataRaw as SocialMediaPlanRow | null;

        if (planError) {
          console.error('Error fetching plan data for auto-complete:', planError);
          return;
        }

        // If approved = true and step is not completed, auto-complete it
        if (planData?.approved === true && !step.is_completed) {
          const now = new Date().toISOString();
          const payload: any = { 
            is_completed: true,
            updated_at: now
          };
          
          setOptimisticCompleted(true);
          setOptimisticUpdatedAt(now);
          
          updateTaskStep(step.id, payload, { autoReorder }).catch((error) => {
            console.error('Error auto-completing Concept step:', error);
            setOptimisticCompleted(null);
            setOptimisticUpdatedAt(null);
          });
        }
      } catch (error) {
        console.error('Error in auto-complete Concept step:', error);
      }
    };

    autoCompleteConceptStep();
  }, [step.social_media_plan_id, step.is_concept_step, step.is_completed, subStepCount, step.id]);

  const handleToggleComplete = async () => {
    // Handle step with social_media_plan_id
    if (step.social_media_plan_id && subStepCount === 0) {
      try {
        // Fetch social media plan data
        const { data: planDataRaw, error: planError } = await supabase
          .from('social_media_plans')
          .select('approved, google_drive_link, production_approved')
          .eq('id', step.social_media_plan_id)
          .single();
        const planData = planDataRaw as SocialMediaPlanRow | null;

        if (planError) {
          console.error('Error fetching social media plan:', planError);
          toast({
            title: 'Error',
            description: 'Failed to fetch plan data',
            variant: 'destructive',
          });
          return;
        }

        // Identify step type: "Concept" or "Content" based on is_concept_step column
        const isConceptStep = step.is_concept_step === true;
        const isContentStep = step.is_concept_step === false;

        // Logic for Concept Step (controlled by approved only)
        if (isConceptStep) {
          if (planData?.approved === true) {
            // If approved = true, allow completion (auto-complete handled by useEffect)
            // Allow manual toggle (check/uncheck)
            // Continue with normal toggle logic below
          } else {
            // If approved = false, block manual toggle
            toast({
              title: 'Completion locked',
              description: 'This step can only be checked from the Social Media Dashboard by approving the plan.',
            });
            return;
          }
        }

        // Logic for Content Step (controlled by production_approved and google_drive_link only, ignore approved)
        if (isContentStep) {
          const hasGoogleDriveLink = planData?.google_drive_link && planData.google_drive_link.trim() !== '';
          const isProductionApproved = planData?.production_approved === true;

          // Block if: google_drive_link IS NULL AND production_approved = false
          if (!hasGoogleDriveLink && !isProductionApproved) {
            toast({
              title: 'Completion locked',
              description: 'Content step requires either a Google Drive link or production approval. Please add the Google Drive link or approve production in the Social Media Plan first.',
            });
            return;
          }
          // Allow if: google_drive_link IS NOT NULL OR production_approved = true
          // Continue with normal toggle logic below
        }
      } catch (error) {
        console.error('Error in handleToggleComplete:', error);
        toast({
          title: 'Error',
          description: 'An error occurred while checking plan data',
          variant: 'destructive',
        });
        return;
      }
    }

    // Steps with sub-steps are fully sub-step-driven and cannot be toggled manually.
    if (stepCheckboxRule.hasSubSteps) {
      if (stepCheckboxRule.reasonKey === 'completeAllSubStepsFirst') {
        toast({
          title: t('dailyTask.cannotCompleteStep', 'Cannot Complete Step'),
          description: t(
            'dailyTask.completeAllSubStepsFirst',
            'Please complete all sub-steps first'
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('dailyTask.cannotUncheckStepWithSubSteps', 'Cannot Reopen Step'),
          description: t(
            'dailyTask.cannotUncheckStepWithSubStepsDesc',
            'Cannot reopen step with sub-steps. Please manage sub-steps individually.'
          ),
          variant: 'destructive',
        });
      }
      return;
    }

    // Tampilkan dialog konfirmasi sebelum toggle (untuk check dan uncheck)
    // Gunakan isCompleted (yang sudah dihitung dari optimistic state atau step.is_completed) untuk menentukan state saat ini
    const currentCompletedState = isCompleted;
    const next = !currentCompletedState;
    setCurrentCompletionState(currentCompletedState); // Simpan state saat ini untuk ditampilkan di dialog
    setPendingCompletionState(next); // Simpan state yang akan menjadi setelah konfirmasi
    setShowConfirmDialog(true);
  };

  const confirmToggleComplete = async () => {
    if (pendingCompletionState === null) return;

    const next = pendingCompletionState;
    setShowConfirmDialog(false);
    setCurrentCompletionState(null);
    
    const payload: any = { is_completed: next };
    const now = new Date().toISOString();
    if (next) {
      payload.updated_at = now;
    }

    // Jika step tidak punya sub-step, langsung update UI (optimistic update) tanpa menunggu
    if (subStepCount === 0) {
      // Update UI immediately
      setOptimisticCompleted(next);
      if (next) {
        setOptimisticUpdatedAt(now);
      } else {
        setOptimisticUpdatedAt(null);
      }

      // Update ke Supabase di background tanpa menunggu
      updateTaskStep(step.id, payload, { autoReorder }).catch((error) => {
        console.error('Error updating task step:', error);
        // Revert optimistic update on error
        setOptimisticCompleted(null);
        setOptimisticUpdatedAt(null);
      });
    } else {
      // Jika ada sub-step, tunggu validasi terlebih dahulu
      await updateTaskStep(step.id, payload, { autoReorder });
    }

    setPendingCompletionState(null);
    setCurrentCompletionState(null);
  };

  // Reset optimistic state when step prop changes (after update completes)
  useEffect(() => {
    if (optimisticCompleted !== null && step.is_completed === optimisticCompleted) {
      setOptimisticCompleted(null);
      setOptimisticUpdatedAt(null);
    }
  }, [step.is_completed, step.updated_at, optimisticCompleted]);

  const handleEditStep = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = () => {
    setDeleteStepDialogOpen(true);
  };

  const handleConfirmDeleteStep = async () => {
    setDeleteStepDialogOpen(false);
    try {
      await deleteTaskStep(step.id);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete step', variant: 'destructive' });
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'File size must be less than 10MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      await uploadTaskStepFile(step.id, file);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteFile = async (fileId: string) => {
    const file = step.files?.find(f => f.id === fileId);
    const fileName = file?.filename || 'this file';
    
    if (window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      await deleteTaskFile(fileId);
    }
  };

  const handleAssignStep = async (employeeId: string, dueDateIso?: string | null) => {
    try {
      await assignTaskStep(step.id, employeeId, dueDateIso || null);
    } catch (error) {
      console.error('Error assigning step:', error);
    }
  };

  const handleUnassignStep = async () => {
    if (window.confirm('Are you sure you want to unassign this step?')) {
      try {
        await assignTaskStep(step.id, null);
      } catch (error) {
        console.error('Error unassigning step:', error);
      }
    }
  };

  const renderActionButtons = () => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsViewSubStepsOpen(true)}
        className="h-6 w-6 p-0 text-gray-400 hover:text-primary relative"
        title="View steps"
      >
        <ListChecks className="w-3 h-3" />
        {subStepCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {subStepCount}
          </div>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFiles(!showFiles)}
        className={`h-6 w-6 p-0 hover:text-gray-600 relative ${
          step.files && step.files.length > 0 
            ? 'text-primary' 
            : 'text-gray-400'
        }`}
        title={`Toggle files ${step.files && step.files.length > 0 ? `(${step.files.length})` : ''}`}
      >
        <Paperclip className="w-3 h-3" />
        {fileCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {fileCount}
          </div>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowLinks(!showLinks)}
        className={`h-6 w-6 p-0 hover:text-gray-600 relative ${
          linkCount > 0 ? 'text-green-500' : 'text-gray-400'
        }`}
        title="Toggle links"
      >
        <Link className="w-3 h-3" />
        {linkCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {linkCount}
          </div>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => canAssign && setShowAssignDialog(true)}
        disabled={!canAssign}
        className={`h-6 w-6 p-0 relative ${
          canAssign
            ? `hover:text-gray-600 ${step.assigned_to ? 'text-green-500' : 'text-gray-400'}`
            : 'opacity-40 cursor-not-allowed text-gray-400'
        }`}
        title={
          canAssign
            ? (step.assigned_to ? `Assigned to ${step.assigned_employee?.full_name || 'Unknown'}` : 'Assign step')
            : 'ðŸ”’ Only task creator can assign steps'
        }
      >
        <Users className="w-3 h-3" />
        {step.assigned_to && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            1
          </div>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistoryModal(true)}
        className={`h-6 w-6 p-0 hover:text-purple-600 relative ${
          historyCount > 0 ? 'text-purple-500' : 'text-gray-400'
        }`}
        title={`View history and manage blockers ${historyCount > 0 ? `(${historyCount})` : ''}`}
      >
        <History className="w-3 h-3" />
        {historyCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {historyCount}
          </div>
        )}
      </Button>
      {isFromMeetingPoint && solutionId && meetingPointId && discussionPoint && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsUpdateHistoryOpen(true)}
          className={`h-6 w-6 p-0 relative ${
            updateHistoryCount > 0 ? 'text-primary hover:text-primary/90' : 'text-primary/80 hover:text-primary'
          }`}
          title={`Update History from Meeting Notes ${updateHistoryCount > 0 ? `(${updateHistoryCount})` : ''}`}
        >
          <FileEdit className="w-3 h-3" />
          {updateHistoryCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {updateHistoryCount > 99 ? '99+' : updateHistoryCount}
            </div>
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => canEdit && handleEditStep()}
        disabled={!canEdit}
        className={`h-6 w-6 p-0 ${
          canEdit 
            ? 'text-gray-400 hover:text-gray-600 cursor-pointer' 
            : 'text-gray-300 opacity-40 cursor-not-allowed'
        }`}
        title={canEdit ? 'Edit step' : 'ðŸ”’ Only task creator can edit steps'}
      >
        <Edit className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => canDelete && handleDelete()}
        disabled={!canDelete}
        className={`h-6 w-6 p-0 ${
          canDelete 
            ? 'text-gray-400 hover:text-red-600 cursor-pointer' 
            : 'text-gray-300 opacity-40 cursor-not-allowed'
        }`}
        title={canDelete ? 'Delete step' : 'ðŸ”’ Only task creator can delete steps'}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </>
  );

  /** contentOnly + MobileTaskStep: keep row fully opaque so swipe strip never shows through */
  const rowClass = contentOnly
    ? `flex flex-col gap-0 px-3 py-2 rounded-lg shadow-sm transition-colors border ${
        isHighlightedFromPendingApproval
          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
          : sortableIsDragging
            ? 'shadow-lg border-primary/25 bg-white'
            : 'border-primary/15 bg-white hover:bg-gray-50'
      }`
    : `flex flex-col gap-0 px-2 py-1.5 rounded-md transition-colors border ${
        isHighlightedFromPendingApproval
          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
          : sortableIsDragging
            ? 'shadow-lg border-primary/25 bg-primary/10'
            : 'border-primary/15 bg-white hover:bg-primary/5'
      }`;
      const rowContent = (
        <>
      {/* Baris: checkbox, grip, title */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleToggleComplete}
          disabled={stepCheckboxRule.isDisabled}
          className={`transition-colors flex-shrink-0 ${
            stepCheckboxRule.isDisabled
              ? 'text-gray-300 cursor-not-allowed opacity-50'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={
            stepCheckboxRule.reasonKey === 'completeAllSubStepsFirst'
              ? t('dailyTask.completeAllSubStepsFirst', 'Please complete all sub-steps first')
              : stepCheckboxRule.reasonKey === 'cannotUncheckStepWithSubSteps'
              ? t(
                  'dailyTask.cannotUncheckStepWithSubStepsDesc',
                  'Cannot reopen step with sub-steps. Please manage sub-steps individually.'
                )
              : isCompleted
              ? 'Buka kembali step'
              : 'Tandai step sebagai selesai'
          }
        >
          {stepCheckboxRule.isChecked ? (
            <CheckSquare className="w-4 h-4 text-green-600" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        <div
          {...handleAttrs}
          {...handleListeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        >
          <GripVertical className="w-4 h-4 text-gray-300 hover:text-gray-500" />
        </div>

        <div
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
          {...(isMobileExpandableCard
            ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-expanded': cardExpanded,
                onClick: () => setCardExpanded((prev) => !prev),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCardExpanded((prev) => !prev);
                  }
                },
              }
            : {})}
        >
            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <span
                className={`text-sm min-w-0 block ${
                  isMobileExpandableCard
                    ? cardExpanded
                      ? 'break-words'
                      : 'truncate'
                    : 'line-clamp-2 md:truncate'
                } ${stepCheckboxRule.isChecked ? 'line-through text-gray-500' : 'text-gray-900'}`}
              >
                {step.title}
              </span>
              {stepRejectReason && (
                <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                  {t('dailyTask.approval.revisionBadge', 'Revision')}
                </Badge>
              )}
            </div>
            {stepRejectReason && (
              <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
                <p className="font-medium text-amber-800">
                  {t('dailyTask.approval.reasonForRejectionLabel', 'Reason for Rejection')}
                </p>
                <p className="text-gray-700 mt-0.5">{stepRejectReason}</p>
              </div>
            )}
            {/* Description with see more functionality */}
            {step.description && step.description.trim() && (
              <div className="mt-1 min-w-0 max-w-full">
                {isMobileExpandableCard && cardExpanded ? (
                  <p className="text-xs text-gray-600 break-words whitespace-pre-wrap">
                    {step.description}
                  </p>
                ) : (
                <div className="flex items-start gap-1">
                  <p
                    className="text-xs text-gray-600 break-words line-clamp-1 overflow-hidden flex-1"
                  >
                    {step.description}
                  </p>
                  {step.description.length > 50 && !isMobileExpandableCard && (
                    isMobile ? (
                      <Dialog open={isDescriptionPopoverOpen} onOpenChange={setIsDescriptionPopoverOpen}>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="flex-shrink-0 cursor-pointer text-xs font-medium text-primary hover:text-primary/90"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDescriptionPopoverOpen(true);
                            }}
                          >
                            See more
                          </button>
                        </DialogTrigger>
                        <DialogContent
                          className="w-[80vmin] max-w-[calc(100vw-2rem)] aspect-square max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
                          hideCloseButton={false}
                          aria-describedby={undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DialogTitle className="sr-only">Description</DialogTitle>
                          <div className="flex-shrink-0 flex items-center justify-between px-4 pr-12 py-3 border-b border-border">
                            <h4 className="text-sm font-semibold text-gray-900">Description</h4>
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {step.description}
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Popover open={isDescriptionPopoverOpen} onOpenChange={setIsDescriptionPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex-shrink-0 cursor-pointer text-xs font-medium text-primary hover:text-primary/90"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDescriptionPopoverOpen(true);
                            }}
                          >
                            See more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-80 p-4"
                          align="center"
                          side="bottom"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-900">Description</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {step.description}
                            </p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  )}
                </div>
                )}
              </div>
            )}
        </div>
      </div>

      <div className="border-t border-gray-200 my-1 w-full" aria-hidden />

      {/* Icons below title when no sub-steps */}
            {subStepCount === 0 && (
              contentOnly ? (
                (step.assigned_due_date || step.assigned_at || isAssignedToMe || (step.assigned_to && isStepCreator) || step.has_assigned_substeps || getOverdueLabel() || getFinishStatusLabel()) && (
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5 text-[10px] text-gray-500 min-w-0">
                    {isAssignedToMe && (
                      <span className="text-[10px] text-green-600">
                        Assigned to you
                      </span>
                    )}
                    {!isAssignedToMe && step.assigned_to && isStepCreator && (
                      <span className="text-[10px] text-primary">
                        Assigned to {step.assigned_employee?.full_name || 'other'}
                      </span>
                    )}
                    {!isAssignedToMe && !step.assigned_to && step.has_assigned_substeps && (
                      <span className="text-[10px] text-purple-600">
                        Sub-step assigned to you
                      </span>
                    )}
                    {step.assigned_due_date && (
                      <span>Due: {new Date(step.assigned_due_date).toLocaleDateString()}</span>
                    )}
                    {step.assigned_at && (
                      <span className="text-gray-500">Assigned: {formatDateTime(step.assigned_at)}</span>
                    )}
                    {getOverdueLabel() && (
                      <span className={getOverdueLabel()!.className}>{getOverdueLabel()!.text}</span>
                    )}
                    {getFinishStatusLabel() && (
                      <span className={getFinishStatusLabel()!.className}>{getFinishStatusLabel()!.text}</span>
                    )}
                  </div>
                )
              ) : (
              <div className="flex items-end justify-between gap-2 flex-wrap">
                {(step.assigned_due_date || step.assigned_at || isAssignedToMe || (step.assigned_to && isStepCreator) || step.has_assigned_substeps || getOverdueLabel() || getFinishStatusLabel()) && (
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5 text-[10px] text-gray-500 min-w-0">
                    {isAssignedToMe && (
                      <span className="text-[10px] text-green-600">
                        Assigned to you
                      </span>
                    )}
                    {!isAssignedToMe && step.assigned_to && isStepCreator && (
                      <span className="text-[10px] text-primary">
                        Assigned to {step.assigned_employee?.full_name || 'other'}
                      </span>
                    )}
                    {!isAssignedToMe && !step.assigned_to && step.has_assigned_substeps && (
                      <span className="text-[10px] text-purple-600">
                        Sub-step assigned to you
                      </span>
                    )}
                    {step.assigned_due_date && (
                      <span>Due: {new Date(step.assigned_due_date).toLocaleDateString()}</span>
                    )}
                    {step.assigned_at && (
                      <span className="text-gray-500">Assigned: {formatDateTime(step.assigned_at)}</span>
                    )}
                    {getOverdueLabel() && (
                      <span className={getOverdueLabel()!.className}>{getOverdueLabel()!.text}</span>
                    )}
                    {getFinishStatusLabel() && (
                      <span className={getFinishStatusLabel()!.className}>{getFinishStatusLabel()!.text}</span>
                    )}
                  </div>
                )}
                <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-300 rounded-lg shadow-sm flex-shrink-0">
                  {!hasSwipe && renderActionButtons()}
                </div>
              </div>
              )
            )}
            {subStepCount > 0 && (
              <>
                {/* Progress bar full width di bawah checkbox */}
                {contentOnly ? (
                  <div className="w-full h-1.5 overflow-hidden rounded bg-gray-200">
                    <div
                      className="h-full rounded bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((subStepCompletedCount / subStepCount) * 100))}%` }}
                    />
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 min-w-0 h-1.5 overflow-hidden rounded bg-gray-200">
                      <div
                        className="h-full rounded bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((subStepCompletedCount / subStepCount) * 100))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">
                      {Math.round((subStepCompletedCount / subStepCount) * 100)}%
                    </span>
                    {!contentOnly && (
                      <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-300 rounded-lg shadow-sm flex-shrink-0">
                        {!hasSwipe && renderActionButtons()}
                      </div>
                    )}
                  </div>
                )}
                <div className={`flex justify-between gap-1 text-[10px] text-gray-500 min-w-0 ${contentOnly ? 'mt-0.5 items-start' : 'mt-1 items-end'}`}>
                  <div className="flex flex-wrap min-w-0 items-end gap-x-1 gap-y-0.5">
                    {isAssignedToMe && (
                      <span className="text-[10px] text-green-600">
                        Assigned to you
                      </span>
                    )}
                    {!isAssignedToMe && step.assigned_to && isStepCreator && (
                      <span className="text-[10px] text-primary">
                        Assigned to {step.assigned_employee?.full_name || 'other'}
                      </span>
                    )}
                    {!isAssignedToMe && !step.assigned_to && step.has_assigned_substeps && (
                      <span className="text-[10px] text-purple-600">
                        Sub-step assigned to you
                      </span>
                    )}
                    {step.assigned_due_date && (
                      <span>Due: {new Date(step.assigned_due_date).toLocaleDateString()}</span>
                    )}
                    {step.assigned_at && (
                      <span className="text-gray-500">Assigned: {formatDateTime(step.assigned_at)}</span>
                    )}
                    {step.assigned_at && (
                      <span>{subStepCompletedCount}/{subStepCount}</span>
                    )}
                    {getOverdueLabel() && (
                      <span className={getOverdueLabel()!.className}>{getOverdueLabel()!.text}</span>
                    )}
                    {isCompleted && completedAt && (
                      <span className="text-gray-500">Finished: {formatDateTime(completedAt)}</span>
                    )}
                    {getFinishStatusLabel() && (
                      <span className={getFinishStatusLabel()!.className}>{getFinishStatusLabel()!.text}</span>
                    )}
                  </div>
                  {contentOnly && (
                    <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">
                      {Math.round((subStepCompletedCount / subStepCount) * 100)}%
                    </span>
                  )}
                </div>
              </>
            )}
        </>
      );

  return (
    <div className="space-y-2">
      {hasSwipe ? (
        <div ref={nodeRef} style={nodeStyle} data-step-id={step.id}>
          <div className="relative overflow-hidden rounded-md">
            <div
              className="absolute right-0 top-0 bottom-0 flex-shrink-0 flex items-stretch rounded-r-md border-l-2 border-slate-300 bg-slate-200 overflow-hidden"
              style={{ width: ACTION_STRIP_WIDTH }}
            >
              {renderActionButtons()}
            </div>
            <div
              ref={slidingRowRef}
              className={rowClass}
              style={{
                minWidth: '100%',
                transform: `translateX(${translateX}px)`,
                touchAction: 'pan-y',
                ...(isSwipeDragging
                  ? { transition: 'none', willChange: 'transform' as const }
                  : { transition: 'transform 0.22s cubic-bezier(0.33, 1, 0.68, 1)' }),
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              {rowContent}
            </div>
          </div>
        </div>
      ) : (
        <div ref={nodeRef} style={nodeStyle} data-step-id={step.id} className={rowClass}>
          {rowContent}
        </div>
      )}

      {/* File Upload and Display Section - Moved outside main container */}
      {/* Saat contentOnly (mobile swipe), tampilkan di modal agar baris tidak memanjang ke bawah */}
    {showFiles && (
      contentOnly ? (
        <Dialog open={showFiles} onOpenChange={(open) => !open && setShowFiles(false)}>
          <DialogContent
            className="max-w-[min(96vw,24rem)] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
            hideCloseButton={false}
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">Files</DialogTitle>
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold">Attachments</h4>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll p-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar,.wav,.mp3,.m4a,.aac,.ogg,.flac,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload File
                  </div>
                )}
              </Button>
              <div className="space-y-2">
                {step.files && step.files.length > 0 ? (
                  step.files.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200">
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{file.filename}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.file_url, '_blank')}
                          className="h-6 w-6 p-0 text-primary hover:text-primary/90"
                          title="View file"
                        >
                          <FileText className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                          title="Delete file"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic text-center">No files attached</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
        {/* File Upload */}
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar,.wav,.mp3,.m4a,.aac,.ogg,.flac,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Uploading...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload File
              </div>
            )}
          </Button>
        </div>

        {/* File List */}
        <div className="space-y-2">
          {step.files && step.files.length > 0 ? (
            step.files.map((file) => (
              <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 flex-1 truncate">{file.filename}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(file.file_url, '_blank')}
                    className="h-6 w-6 p-0 text-primary hover:text-primary/90"
                    title="View file"
                  >
                    <FileText className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(file.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                    title="Delete file"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic text-center">No files attached</p>
          )}
        </div>
      </div>
    )
    )}

    {/* Links Section */}
    {showLinks && (
      contentOnly ? (
        <Dialog open={showLinks} onOpenChange={(open) => !open && setShowLinks(false)}>
          <DialogContent
            className="max-w-[min(96vw,24rem)] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
            hideCloseButton={false}
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">Links</DialogTitle>
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold">Links</h4>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll p-4">
              <StepLinks
                taskStepId={step.id}
                isExpanded={true}
                onLinksChange={async () => {
                  try {
                    const { count: linksCount } = await supabase
                      .from('task_step_links')
                      .select('*', { count: 'exact', head: true })
                      .eq('task_step_id', step.id);
                    setLinkCount(linksCount || 0);
                  } catch (error) {
                    console.error('Error refreshing link count:', error);
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
      <StepLinks
        taskStepId={step.id}
        isExpanded={showLinks}
        onLinksChange={async () => {
          // Refresh link count when links change
          try {
            const { count: linksCount } = await supabase
              .from('task_step_links')
              .select('*', { count: 'exact', head: true })
              .eq('task_step_id', step.id);
            setLinkCount(linksCount || 0);
          } catch (error) {
            console.error('Error refreshing link count:', error);
          }
        }}
      />
      )
    )}

    {showAssignDialog ? (
      <AssignStepDialog
        step={step}
        onAssign={handleAssignStep}
        onUnassign={handleUnassignStep}
        onClose={() => setShowAssignDialog(false)}
      />
    ) : null}

    {/* History Modal */}
    {showHistoryModal && (
      <StepHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        taskStepId={step.id}
        stepTitle={step.title}
        currentStatus={step.status || 'pending'}
        currentPriority={step.priority || 'medium'}
        taskId={step.task_id}
        onHistoryUpdate={async () => {
          // Refresh history count after adding entry using RPC
          try {
            const { data: count, error } = await (supabase as any).rpc('get_step_history_count', {
              p_task_step_id: step.id
            });
            
            if (error) {
              console.error('Error refreshing history count:', error);
            } else {
              setHistoryCount(count || 0);
            }
          } catch (error) {
            console.error('Error refreshing history count:', error);
          }
        }}
      />
    )}
    <ModalViewSubSteps
      open={isViewSubStepsOpen}
      onOpenChange={setIsViewSubStepsOpen}
      parentStepId={step.id}
      parentStepTitle={step.title}
      taskCreatedBy={taskCreatedBy}
      preferSwipeLayout={contentOnly}
      onParentCompletionChange={async (completed) => {
        try {
          const payload: any = { is_completed: completed };
          if (completed) {
            payload.updated_at = new Date().toISOString();
          }
          await updateTaskStep(step.id, payload, { autoReorder });
        } catch (_) {
          // ignore
        }
      }}
    />

    {/* Update History Dialog from Meeting Point */}
    {isFromMeetingPoint && solutionId && meetingPointId && discussionPoint && (
      <UpdateHistoryDialog
        isOpen={isUpdateHistoryOpen}
        onClose={() => setIsUpdateHistoryOpen(false)}
        meetingPointId={meetingPointId}
        solutionId={solutionId}
        discussionPoint={discussionPoint}
      />
    )}

    {/* Confirmation Dialog for Step Completion Toggle */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {currentCompletionState ? 'Konfirmasi Membuka Kembali Step' : 'Konfirmasi Menyelesaikan Step'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {currentCompletionState
              ? `Apakah Anda yakin ingin membuka kembali step "${step.title}"?`
              : `Apakah Anda yakin ingin menandai step "${step.title}" sebagai selesai?`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setShowConfirmDialog(false);
            setPendingCompletionState(null);
            setCurrentCompletionState(null);
          }}>
            Batal
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmToggleComplete}>
            {currentCompletionState ? 'Ya, Buka Kembali' : 'Ya, Selesaikan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Delete Step Confirmation */}
    <AlertDialog open={deleteStepDialogOpen} onOpenChange={setDeleteStepDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Step</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this step? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDeleteStep}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Edit Step Modal */}
    <ModalAddTaskStep
      open={isEditModalOpen}
      onOpenChange={setIsEditModalOpen}
      taskId={step.task_id}
      taskTitle={taskTitle || 'Task'}
      editingStep={{
        id: step.id,
        title: step.title,
        description: step.description ?? null,
      }}
      onSuccess={() => {
        setIsEditModalOpen(false);
      }}
    />
    </div>
  );
});






