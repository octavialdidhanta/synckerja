import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
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
import { Plus, Edit, Trash2, History, Users, ArrowLeft } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { StepHistoryModal } from './StepHistoryModal';
import { AssignSubStepDialog } from './AssignSubStepDialog';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { logger } from '@/shared/lib/logger';
import { createCompletionApprovalIfAssignee } from '../services/completionApprovalService';
import { useDailyTaskOptional } from '../context/DailyTaskContext';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface SubStep {
  id: string;
  parent_step_id: string;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  assigned_to?: string | null;
  assigned_employee?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
}

interface ParentPlanInfo {
  id: string;
  google_drive_link?: string | null;
  production_status?: string | null;
  production_approved?: boolean | null;
  is_concept_step?: boolean; // true for Concept step, false for Content step
}

interface ModalViewSubStepsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentStepId: string;
  parentStepTitle: string;
  onParentCompletionChange?: (completed: boolean) => void;
  taskCreatedBy?: string; // Task creator user ID for permission check
  /** When true, use slide-to-reveal layout for sub-step rows (e.g. when opened from mobile step). Overrides viewport check. */
  preferSwipeLayout?: boolean;
}

/** Slide-to-reveal constants (same pattern as MobileTaskStep) */
const SUBSTEP_ACTION_STRIP_WIDTH = 200;
const SWIPE_THRESHOLD = 28;
const DIRECTION_LOCK_PX = 8;
const DIRECTION_LOCK_PX_WHEN_OPEN = 4;
const MIN_SWIPE_MOVEMENT = 24;
const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';

interface MobileSubStepRowProps {
  subStep: SubStep;
  isRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  onToggleCompleted: (id: string, current: boolean) => void;
  onAssignClick: (s: SubStep) => void;
  onHistoryClick: (id: string) => void;
  onEditClick: (id: string, title: string) => void;
  onDeleteClick: (id: string) => void;
  editingId: string | null;
  editTitle: string;
  onEditTitleChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isTaskCreator: boolean;
  rejectedReason: string | undefined;
  historyCount: number;
  t: (key: string, fallback?: string) => string;
  /** When true, edit is shown in a dialog instead of inline in the row */
  useEditDialog?: boolean;
}

const MobileSubStepRow: React.FC<MobileSubStepRowProps> = ({
  subStep: s,
  isRevealed,
  onReveal,
  onClose,
  onToggleCompleted,
  onAssignClick,
  onHistoryClick,
  onEditClick,
  onDeleteClick,
  editingId,
  editTitle,
  onEditTitleChange,
  onSaveEdit,
  onCancelEdit,
  isTaskCreator,
  rejectedReason,
  historyCount,
  t,
  useEditDialog = false,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
    didSwipe: boolean;
  } | null>(null);
  const translateXRef = useRef(0);
  const slidingRef = useRef<HTMLDivElement>(null);
  const lockHorizontalRef = useRef(false);

  if (touchStartRef.current == null) translateXRef.current = translateX;
  lockHorizontalRef.current = touchStartRef.current?.lockHorizontal === true;

  useEffect(() => {
    if (!isRevealed && translateX !== 0) {
      setTranslateX(0);
      translateXRef.current = 0;
    }
  }, [isRevealed, translateX]);

  useEffect(() => {
    if (!slidingRef.current) return;
    const el = slidingRef.current;
    const onMove = (e: TouchEvent) => {
      if (lockHorizontalRef.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  // Auto-collapse after 5s when expanded (same as TaskStep mobile)
  useEffect(() => {
    if (!cardExpanded) {
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
  }, [cardExpanded]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateX,
      lockHorizontal: null,
      didSwipe: false,
    };
    const el = slidingRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${translateX}px)`;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - start.startX;
    const deltaY = currentY - start.startY;

    if (start.lockHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const stripWasOpen = start.startTranslateX < -SWIPE_THRESHOLD;
      if (stripWasOpen) {
        if (absX > DIRECTION_LOCK_PX_WHEN_OPEN) {
          start.lockHorizontal = true;
          lockHorizontalRef.current = true;
        } else if (absY > DIRECTION_LOCK_PX) {
          start.lockHorizontal = false;
          lockHorizontalRef.current = false;
        }
      } else {
        if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
          start.lockHorizontal = absX >= absY;
          lockHorizontalRef.current = start.lockHorizontal;
        }
      }
    }

    if (start.lockHorizontal === true) {
      const next = Math.min(0, Math.max(-SUBSTEP_ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
      if (Math.abs(deltaX) >= MIN_SWIPE_MOVEMENT) start.didSwipe = true;
      translateXRef.current = next;
      const el = slidingRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    const el = slidingRef.current;
    lockHorizontalRef.current = false;
    touchStartRef.current = null;
    const current = translateXRef.current;
    const wasOpen = start != null && start.startTranslateX < -SWIPE_THRESHOLD;
    const closedBySwipe = wasOpen && current > -SWIPE_THRESHOLD;
    const openedBySwipe = start?.didSwipe === true && current < -SWIPE_THRESHOLD && !closedBySwipe;
    const targetX = openedBySwipe ? -SUBSTEP_ACTION_STRIP_WIDTH : 0;

    if (el) {
      el.style.transition = SNAP_TRANSITION;
      el.style.transform = `translateX(${targetX}px)`;
    }
    translateXRef.current = targetX;
    setIsDragging(false);
    setTranslateX(targetX);
    if (openedBySwipe) onReveal();
    else onClose();
  };

  const actionStrip = (
    <div
      className="absolute right-0 top-0 bottom-0 flex-shrink-0 flex items-stretch rounded-r-md border-l-2 border-slate-300 bg-slate-200 overflow-hidden"
      style={{ width: SUBSTEP_ACTION_STRIP_WIDTH }}
    >
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-green-200/80 px-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAssignClick(s); }} className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-green-900 hover:bg-green-300" title={s.assigned_to ? `Assigned to ${s.assigned_employee?.full_name || 'Unknown'}` : 'Assign'} disabled={!isTaskCreator}>
          <Users className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-purple-200/80 px-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onHistoryClick(s.id); }} className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-purple-900 hover:bg-purple-300 relative" title="History & Blockers">
          <History className="w-3 h-3" />
          {historyCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{historyCount}</span>
          )}
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-blue-200/80 px-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEditClick(s.id, s.title); }} className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-blue-900 hover:bg-blue-300" title="Edit" disabled={!isTaskCreator}>
          <Edit className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 bg-red-200/80 px-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteClick(s.id); }} className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-red-900 hover:bg-red-300" title="Delete" disabled={!isTaskCreator}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {actionStrip}
      <div
        ref={slidingRef}
        className="min-w-full bg-white rounded-lg flex items-center gap-2 px-3 py-2"
        style={{
          minWidth: '100%',
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y',
          ...(isDragging ? { transition: 'none', willChange: 'transform' as const } : { transition: SNAP_TRANSITION }),
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Checkbox
          checked={s.is_completed}
          onCheckedChange={() => onToggleCompleted(s.id, s.is_completed)}
          className="text-gray-400 hover:text-gray-600"
        />
        {!useEditDialog && editingId === s.id ? (
          <div className="flex items-center gap-2 flex-1">
            <Input value={editTitle} onChange={(e) => onEditTitleChange(e.target.value)} className="flex-1 h-8 text-sm" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); else if (e.key === 'Escape') onCancelEdit(); }} />
            <Button variant="ghost" size="sm" onClick={onSaveEdit} className="h-8 px-2 text-green-600">Save</Button>
            <Button variant="ghost" size="sm" onClick={onCancelEdit} className="h-8 px-2 text-gray-500">Cancel</Button>
          </div>
        ) : (
          <>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              role="button"
              tabIndex={0}
              aria-expanded={cardExpanded}
              onClick={() => setCardExpanded((prev) => !prev)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCardExpanded((prev) => !prev);
                }
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm min-w-0 block ${
                    cardExpanded ? 'break-words' : 'truncate'
                  } ${s.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                >
                  {s.title}
                </span>
                {rejectedReason && <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">{t('dailyTask.approval.revisionBadge', 'Revision')}</Badge>}
              </div>
              {rejectedReason && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
                  <p className="font-medium text-amber-800">{t('dailyTask.approval.reasonForRejectionLabel', 'Reason for Rejection')}</p>
                  <p className="text-gray-700 mt-0.5">{rejectedReason}</p>
                </div>
              )}
              {s.is_completed && s.updated_at && (
                <div className="text-[10px] text-gray-400 mt-0.5">Completed: {new Date(s.updated_at).toLocaleString()}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ModalViewSubSteps = ({ open, onOpenChange, parentStepId, parentStepTitle, onParentCompletionChange, taskCreatedBy, preferSwipeLayout }: ModalViewSubStepsProps) => {
  const [loading, setLoading] = useState(false);
  const [subSteps, setSubSteps] = useState<SubStep[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');
  const [showHistoryForSubStep, setShowHistoryForSubStep] = useState<string | null>(null);
  const [historyCounts, setHistoryCounts] = useState<Record<string, number>>({});
  const [assignDialogSubStep, setAssignDialogSubStep] = useState<SubStep | null>(null);
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentEmployee();
  const { t } = useAppTranslation();
  const dailyTaskContext = useDailyTaskOptional();
  const rejectedReasonsBySubStepId = dailyTaskContext?.rejectedReasonsBySubStepId ?? {};
  const isMobile = useIsMobile();
  /** Use slide-to-reveal for sub-step rows when opened from mobile step (contentOnly) or when viewport is mobile */
  const useSwipeLayout = preferSwipeLayout === true || isMobile;
  const [parentPlan, setParentPlan] = useState<ParentPlanInfo | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubStepId, setPendingSubStepId] = useState<string | null>(null);
  const [pendingSubStepCurrent, setPendingSubStepCurrent] = useState<boolean | null>(null);
  const [revealedSubStepId, setRevealedSubStepId] = useState<string | null>(null);
  /** When true (mobile), edit sub-step opens a dialog instead of inline */
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Check if current user is the creator of the task
  const isTaskCreator = taskCreatedBy === user?.id;

  const fetchSubSteps = async () => {
    const isDev = import.meta.env?.DEV;
    if (isDev) {
      logger.debug('🔍 Fetching sub-steps:', { organizationId, parentStepId });
    }
    
    if (!organizationId || !parentStepId) {
      if (isDev) {
        logger.warn('⚠️ Missing organizationId or parentStepId');
      }
      return;
    }
    
    try {
      setLoading(true);
      
      // First attempt: with organization_id filter
      let { data, error } = await supabase
        .from('task_steps_to_steps')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('parent_step_id', parentStepId)
        .order('order', { ascending: true })
        .order('created_at', { ascending: true });
      
      if (isDev) {
        logger.debug('📊 Sub-steps query result (with org filter):', { data, error, count: data?.length });
      }
      
      // If no data found with organization_id, try without it (fallback)
      if (!error && (!data || data.length === 0)) {
        if (isDev) {
          logger.debug('🔄 No data with org filter, trying without org filter...');
        }
        const fallbackResult = await supabase
          .from('task_steps_to_steps')
          .select('*')
          .eq('parent_step_id', parentStepId)
          .order('order', { ascending: true })
          .order('created_at', { ascending: true });
        
        if (isDev) {
          logger.debug('📊 Sub-steps fallback query result:', { 
            data: fallbackResult.data, 
            error: fallbackResult.error, 
            count: fallbackResult.data?.length 
          });
        }
        
        if (!fallbackResult.error && fallbackResult.data) {
          data = fallbackResult.data;
          error = fallbackResult.error;
        }
      }
      
      if (error) {
        console.error('❌ Error fetching sub-steps:', error);
        throw error;
      }
      
      // Fetch assignments for these sub-steps
      const subStepIds = (data || []).map((d: any) => d.id);
      let subStepsWithAssignment = (data || []) as SubStep[];
      
      if (subStepIds.length > 0) {
        const { data: assignments, error: assignError } = await supabase
          .from('task_steps_to_steps_assigned')
          .select(`
            id,
            task_steps_to_steps_id,
            employee_id,
            employee:employees!employee_id(id, full_name, email)
          `)
          .in('task_steps_to_steps_id', subStepIds)
          .order('assigned_at', { ascending: false });
        
        if (!assignError && assignments) {
          // Group assignments by task_steps_to_steps_id (keep only latest)
          const assignmentMap: Record<string, any> = {};
          assignments.forEach((a: any) => {
            if (!assignmentMap[a.task_steps_to_steps_id]) {
              assignmentMap[a.task_steps_to_steps_id] = a;
            }
          });
          
          // Merge assignment data with sub-steps
          subStepsWithAssignment = (data || []).map((s: any) => ({
            ...s,
            assigned_to: assignmentMap[s.id]?.employee_id || null,
            assigned_employee: assignmentMap[s.id]?.employee || null
          }));
        }
      }
      
      setSubSteps(subStepsWithAssignment);
      if (isDev) {
        logger.debug('✅ Sub-steps set to state:', subStepsWithAssignment.length || 0, 'items');
      }
      
      await syncParentCompletion(subStepsWithAssignment);

      // Fetch history counts for these sub-steps (with graceful degradation)
      const ids = (data || []).map((d: any) => d.id);
      if (ids.length > 0) {
        // OPTIMIZATION: Make this non-blocking with timeout protection
        // This is a non-critical UI enhancement that can fail gracefully
        Promise.race([
          supabase
            .from('task_step_history')
            .select('task_steps_to_steps_id')
            .in('task_steps_to_steps_id', ids),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('History count timeout')), 3000)
          )
        ])
        .then((result: any) => {
          if (result?.data && !result?.error) {
            const tally: Record<string, number> = {};
            (result.data || []).forEach((row: any) => {
              const key = row.task_steps_to_steps_id;
              tally[key] = (tally[key] || 0) + 1;
            });
            setHistoryCounts(tally);
          }
        })
        .catch((err) => {
          // Only log in development mode - this is non-critical
          if (import.meta.env.DEV) {
            logger.debug('History count fetch failed (non-critical):', err);
          }
          setHistoryCounts({}); // Show sub-steps without counts - graceful degradation
        });
      } else {
        setHistoryCounts({});
      }
    } catch (err) {
      console.error('Error loading sub-steps:', err);
      toast({ title: 'Error', description: 'Failed to load steps', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const syncParentCompletion = async (steps?: SubStep[]) => {
    try {
      const list = steps ?? subSteps;
      const hasAny = (list?.length || 0) > 0;
      const allCompleted = hasAny && (list ?? []).every(s => s.is_completed);
      const payload: any = {
        is_completed: allCompleted,
        completed_at: allCompleted ? new Date().toISOString() : null,
      };
      if (allCompleted) {
        payload.updated_at = new Date().toISOString();
      }
      await supabase
        .from('task_steps')
        .update(payload)
        .eq('id', parentStepId);
      onParentCompletionChange?.(allCompleted);
    } catch (err) {
      // ignore
    }
  };

  const toggleCompleted = async (id: string, current: boolean) => {
    // Tampilkan dialog konfirmasi sebelum toggle
    setPendingSubStepId(id);
    setPendingSubStepCurrent(current);
    setShowConfirmDialog(true);
  };

  const confirmToggleCompleted = async () => {
    if (!pendingSubStepId || pendingSubStepCurrent === null) return;

    const id = pendingSubStepId;
    const current = pendingSubStepCurrent;
    setShowConfirmDialog(false);

    try {
      const willBeCompleted = !current;
      
      // Check if this is the last sub-step being completed
      // Find the last sub-step by order
      const sortedSubSteps = [...subSteps].sort((a, b) => b.order - a.order);
      const lastSubStep = sortedSubSteps[0];
      const isLastSubStep = lastSubStep?.id === id;
      
      // Check if parent step is Content step using is_concept_step column
      const isContentStep = parentPlan?.is_concept_step === false;
      
      // For Content step, check if completing the last sub-step requires Google Drive link or production approval
      if (
        willBeCompleted &&
        isLastSubStep &&
        isContentStep &&
        parentPlan?.id
      ) {
        const hasGoogleDriveLink = parentPlan.google_drive_link && parentPlan.google_drive_link.trim() !== '';
        const isProductionApproved = parentPlan.production_approved === true;
        
        // Block if: google_drive_link IS NULL AND production_approved = false
        if (!hasGoogleDriveLink && !isProductionApproved) {
          toast({
            title: 'Completion locked',
            description: 'Content step requires either a Google Drive link or production approval. Please add the Google Drive link or approve production in the Social Media Plan first.',
            variant: 'destructive'
          });
          setPendingSubStepId(null);
          setPendingSubStepCurrent(null);
          return;
        }
      }
      
      // Original logic: Check if finishing all sub-steps (for non-Content steps or non-last sub-steps)
      const isFinishingAllSubSteps =
        willBeCompleted &&
        subSteps.length > 0 &&
        subSteps.every(s => (s.id === id ? true : s.is_completed));

      // Only apply Google Drive link check for non-Content steps or when not the last sub-step
      if (
        isFinishingAllSubSteps &&
        !isContentStep &&
        parentPlan?.id &&
        (!parentPlan.google_drive_link || parentPlan.google_drive_link.trim() === '')
      ) {
        toast({
          title: 'Lengkapi Google Drive Link',
          description: 'Isi Google Drive link pada halaman Social Media sebelum menuntaskan semua sub-step.',
          variant: 'destructive'
        });
        setPendingSubStepId(null);
        setPendingSubStepCurrent(null);
        return; // Prevent completion if Google Drive link is missing
      }

      // Prepare update data with completed_at handling
      const updateData: any = { is_completed: !current };
      
      // If is_completed is being updated, ensure completed_at is set correctly
      // This matches the check constraint: (is_completed = TRUE AND completed_at IS NOT NULL) OR (is_completed = FALSE AND completed_at IS NULL)
      if (willBeCompleted) {
        // If marking as completed, set completed_at to NOW()
        updateData.completed_at = new Date().toISOString();
      } else {
        // If marking as not completed, set completed_at to NULL
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('task_steps_to_steps')
        .update(updateData)
        .eq('id', id)
        .eq('parent_step_id', parentStepId)
        .eq('organization_id', organizationId);
      if (error) throw error;
      const nowIso = new Date().toISOString();
      const updated = subSteps.map(s => (
        s.id === id
          ? { ...s, is_completed: !current, updated_at: !current ? nowIso : s.updated_at }
          : s
      ));
      setSubSteps(updated);
      await syncParentCompletion(updated);

      // When assignee marks sub-step completed, create pending approval for assigner
      if (willBeCompleted && organizationId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: currentEmp } = await supabase.from('employees').select('id').eq('user_id', user?.id).eq('organization_id', organizationId).maybeSingle();
        const { data: subAssignment } = await supabase
          .from('task_steps_to_steps_assigned')
          .select('employee_id, assigned_by')
          .eq('task_steps_to_steps_id', id)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fallback: if sub-step is not explicitly assigned, use step-level assignment; then task-level assignment.
        const stepFallback = await supabase
          .from('task_steps_assigned')
          .select('employee_id, assigned_by')
          .eq('task_step_id', parentStepId)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: parentStep } = await supabase.from('task_steps').select('task_id').eq('id', parentStepId).single();
        const dailyTaskId = (parentStep as any)?.task_id;

        const taskFallback = dailyTaskId
          ? (await supabase
              .from('daily_tasks_assigned')
              .select('employee_id, assigned_by')
              .eq('daily_task_id', dailyTaskId)
              .order('assigned_at', { ascending: false })
              .limit(1)
              .maybeSingle()).data
          : null;

        const effectiveAssignment =
          subAssignment?.employee_id && subAssignment?.assigned_by
            ? subAssignment
            : stepFallback.data?.employee_id && stepFallback.data?.assigned_by
              ? stepFallback.data
              : taskFallback;

        if (currentEmp?.id && effectiveAssignment && effectiveAssignment.employee_id === currentEmp.id && effectiveAssignment.assigned_by) {
          if (dailyTaskId) {
            await createCompletionApprovalIfAssignee({
              organizationId,
              entityType: 'substep',
              dailyTaskId,
              taskStepId: parentStepId,
              taskStepsToStepsId: id,
              assigneeEmployeeId: effectiveAssignment.employee_id,
              assignerEmployeeId: effectiveAssignment.assigned_by,
              completedAt: updateData.completed_at || new Date().toISOString(),
            });
          }
        }
      }

      // insert recent update history for sub-step
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase as any)
          .from('task_step_history')
          .insert({
            task_step_id: parentStepId,
            task_steps_to_steps_id: id,
            action_type: 'status_change',
            old_value: current ? 'completed' : 'pending',
            new_value: !current ? 'completed' : 'pending',
            description: !current ? 'Sub-step completed' : 'Sub-step reopened',
            created_by: user?.id || null,
          });
      } catch (_) {}
      
      setPendingSubStepId(null);
      setPendingSubStepCurrent(null);
    } catch (err) {
      console.error('Error toggling sub-step:', err);
      toast({ title: 'Error', description: 'Failed to update step', variant: 'destructive' });
      setPendingSubStepId(null);
      setPendingSubStepCurrent(null);
    }
  };

  const addSubStep = async () => {
    if (!newTitle.trim() || !organizationId) return;
    try {
      setAdding(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;
      const { data, error } = await supabase
        .from('task_steps_to_steps')
        .insert([
          {
            parent_step_id: parentStepId,
            title: newTitle.trim(),
            organization_id: organizationId,
            created_by: userId,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      setSubSteps(prev => [...prev, data as SubStep]);
      setHistoryCounts(prev => ({ ...prev, [(data as any).id]: 0 }));
      setNewTitle('');
      await syncParentCompletion([...(subSteps || []), { ...(data as SubStep), is_completed: false }]);
    } catch (err) {
      console.error('Error adding sub-step:', err);
      toast({ title: 'Error', description: 'Failed to add step', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

	const startEdit = (id: string, title: string) => {
		setEditingId(id);
		setEditTitle(title);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditTitle('');
	};

	const saveEdit = async () => {
		if (!editingId || !organizationId) return;
		const trimmed = editTitle.trim();
		if (!trimmed) return;
		try {
			const { error } = await supabase
				.from('task_steps_to_steps')
				.update({ title: trimmed })
				.eq('id', editingId)
				.eq('parent_step_id', parentStepId)
				.eq('organization_id', organizationId);
			if (error) throw error;
			setSubSteps(prev => prev.map(s => (s.id === editingId ? { ...s, title: trimmed } : s)));
			setEditingId(null);
			setEditTitle('');
		} catch (err) {
			console.error('Error updating sub-step:', err);
			toast({ title: 'Error', description: 'Failed to update step', variant: 'destructive' });
		}
	};

	const deleteSubStep = async (id: string) => {
		if (!organizationId) return;
		if (!window.confirm('Are you sure you want to delete this step?')) return;
		try {
			const { error } = await supabase
				.from('task_steps_to_steps')
				.delete()
				.eq('id', id)
				.eq('parent_step_id', parentStepId)
				.eq('organization_id', organizationId);
			if (error) throw error;
      const filtered = subSteps.filter(s => s.id !== id);
      setSubSteps(filtered);
      await syncParentCompletion(filtered);
			if (editingId === id) cancelEdit();
		} catch (err) {
			console.error('Error deleting sub-step:', err);
			toast({ title: 'Error', description: 'Failed to delete step', variant: 'destructive' });
		}
	};

  const handleAssignSubStep = async (subStepId: string, employeeId: string | null, dueDateIso?: string | null) => {
    const isDev = import.meta.env?.DEV;
    try {
      if (isDev) {
        logger.debug('🎯 Assigning sub-step:', { subStepId, employeeId, dueDateIso });
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (employeeId) {
        // Validate due_date is provided (required)
        if (!dueDateIso) {
          toast({
            title: 'Error',
            description: 'Due date is required when assigning sub-step',
            variant: 'destructive'
          });
          return;
        }

        // Delete existing assignments
        await supabase
          .from('task_steps_to_steps_assigned')
          .delete()
          .eq('task_steps_to_steps_id', subStepId);

        // Create new assignment
        const { data: inserted, error } = await supabase
          .from('task_steps_to_steps_assigned')
          .insert({
            organization_id: organizationId,
            task_steps_to_steps_id: subStepId,
            employee_id: employeeId,
            assigned_by: currentEmployee?.id || null,
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;

        // Save due_date to task_steps_assigned_duedate
        const { error: dueDateError } = await supabase
          .from('task_steps_assigned_duedate')
          .insert({
            organization_id: organizationId,
            task_steps_to_steps_assigned_id: inserted.id,
            due_date: dueDateIso,
          });

        if (dueDateError) {
          console.error('❌ Error saving sub-step due_date:', dueDateError);
          toast({
            title: 'Warning',
            description: 'Sub-step assigned but due date not saved',
            variant: 'destructive'
          });
        } else if (isDev) {
          logger.debug('✅ Sub-step due_date saved successfully');
        }

        if (isDev) {
          logger.debug('✅ Sub-step assigned successfully');
        }
      } else {
        // Unassign
        const { error } = await supabase
          .from('task_steps_to_steps_assigned')
          .delete()
          .eq('task_steps_to_steps_id', subStepId);

        if (error) throw error;
        if (isDev) {
          logger.debug('✅ Sub-step unassigned successfully');
        }
      }

      toast({
        title: 'Success',
        description: employeeId ? 'Sub-step assigned successfully' : 'Sub-step unassigned successfully'
      });

      // Refresh sub-steps to get updated assignment
      await fetchSubSteps();
      setAssignDialogSubStep(null);
    } catch (error) {
      console.error('Error assigning sub-step:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign sub-step',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (!open || !parentStepId) {
      return;
    }

    const fetchParentPlan = async () => {
      try {
        const { data: stepPlan } = await supabase
          .from('task_steps')
          .select('social_media_plan_id, is_concept_step')
          .eq('id', parentStepId)
          .maybeSingle();

        if (!stepPlan?.social_media_plan_id) {
          setParentPlan(null);
          return;
        }

        const { data: planData } = await supabase
          .from('social_media_plans')
          .select('google_drive_link, production_status, production_approved')
          .eq('id', stepPlan.social_media_plan_id)
          .maybeSingle();

        // Store parent step's is_concept_step for Content step check
        const parentIsConceptStep = stepPlan.is_concept_step === true;

        setParentPlan({
          id: stepPlan.social_media_plan_id,
          google_drive_link: planData?.google_drive_link ?? null,
          production_status: planData?.production_status ?? null,
          production_approved: planData?.production_approved ?? null,
          is_concept_step: parentIsConceptStep
        });
      } catch (error) {
        console.error('Error fetching parent plan info:', error);
        setParentPlan(null);
      }
    };

    fetchParentPlan();
  }, [open, parentStepId]);

  useEffect(() => {
    if (open) fetchSubSteps();
    if (!open) setRevealedSubStepId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parentStepId, organizationId]);

  // Filter visible sub-steps based on assignment or creation
  const visibleSubSteps = subSteps.filter(s => s.assigned_to === currentEmployee?.id || s.created_by === user?.id || isTaskCreator);
  const completedCount = visibleSubSteps.filter(s => s.is_completed).length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none h-dvh min-h-0 rounded-none modal-above-safe-area'
            : 'w-[620px] max-w-[90vw] max-h-[90vh] h-[600px]'
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top',
            isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'
          )}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 hover:bg-blue-100/80 flex-shrink-0"
              aria-label="Close"
            >
              <ArrowLeft className="w-5 h-5 text-blue-600" />
            </Button>
            <div className="min-w-0 flex-1">
              <DialogTitle className={cn('text-lg font-semibold flex items-center gap-2 truncate', !isMobile && 'md:text-xl')}>
                Steps
                <Badge variant="secondary">{completedCount}/{visibleSubSteps.length}</Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1 truncate">
                {parentStepTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll',
            isMobile ? 'px-2 pt-2 pb-2 space-y-4' : 'px-6 py-6 space-y-4'
          )}
          style={
            !isMobile
              ? {
                  scrollbarWidth: 'thin',
                  scrollBehavior: 'smooth',
                  scrollbarColor: '#d1d5db transparent',
                }
              : undefined
          }
        >
          {/* Inline Add Form */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a new step..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSubStep();
              }}
              className="flex-1 text-sm"
              disabled={adding}
            />
            <Button type="button" size="sm" onClick={addSubStep} disabled={!newTitle.trim() || adding} className="min-w-[2.25rem]">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

		  <div className="min-h-0">
		  {loading ? (
					<div className="text-sm text-gray-500">Loading...</div>
				) : visibleSubSteps.length === 0 ? (
					<div className="text-sm text-gray-500 italic">No steps yet</div>
				) : (
					<ul className="space-y-1">
						{visibleSubSteps.map((s) =>
              useSwipeLayout ? (
                <li key={s.id}>
                  <MobileSubStepRow
                    subStep={s}
                    isRevealed={revealedSubStepId === s.id}
                    onReveal={() => setRevealedSubStepId(s.id)}
                    onClose={() => setRevealedSubStepId(null)}
                    onToggleCompleted={toggleCompleted}
                    onAssignClick={setAssignDialogSubStep}
                    onHistoryClick={setShowHistoryForSubStep}
                    onEditClick={(id, title) => {
                      startEdit(id, title);
                      setEditDialogOpen(true);
                    }}
                    onDeleteClick={deleteSubStep}
                    editingId={editingId}
                    editTitle={editTitle}
                    onEditTitleChange={setEditTitle}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    isTaskCreator={!!isTaskCreator}
                    rejectedReason={rejectedReasonsBySubStepId[s.id]}
                    historyCount={historyCounts[s.id] ?? 0}
                    t={t}
                    useEditDialog={true}
                  />
                </li>
              ) : (
                <li key={s.id} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200 hover:bg-gray-50">
								<Checkbox
									checked={s.is_completed}
									onCheckedChange={() => toggleCompleted(s.id, s.is_completed)}
									className="text-gray-400 hover:text-gray-600"
								/>
                  {editingId === s.id ? (
									<div className="flex items-center gap-2 flex-1">
										<Input
											value={editTitle}
											onChange={(e) => setEditTitle(e.target.value)}
											className="flex-1 h-8 text-sm"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === 'Enter') saveEdit();
												else if (e.key === 'Escape') cancelEdit();
											}}
										/>
										<Button variant="ghost" size="sm" onClick={saveEdit} className="h-8 px-2 text-green-600 hover:text-green-700">Save</Button>
										<Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 px-2 text-gray-500 hover:text-gray-700">Cancel</Button>
									</div>
								) : (
									<>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm ${s.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>{s.title}</span>
                          {rejectedReasonsBySubStepId[s.id] && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                              {t('dailyTask.approval.revisionBadge', 'Revision')}
                            </Badge>
                          )}
                        </div>
                        {rejectedReasonsBySubStepId[s.id] && (
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
                            <p className="font-medium text-amber-800">{t('dailyTask.approval.reasonForRejectionLabel', 'Reason for Rejection')}</p>
                            <p className="text-gray-700 mt-0.5">{rejectedReasonsBySubStepId[s.id]}</p>
                          </div>
                        )}
                        {s.is_completed && s.updated_at && (
                          <div className="text-[10px] text-gray-400 mt-0.5">Completed: {new Date(s.updated_at).toLocaleString()}</div>
                        )}
                      </div>
										<div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => isTaskCreator && setAssignDialogSubStep(s)} disabled={!isTaskCreator}
                        className={`h-6 w-6 p-0 relative ${isTaskCreator ? `hover:text-gray-600 ${s.assigned_to ? 'text-green-500' : 'text-gray-400'}` : 'opacity-40 cursor-not-allowed text-gray-400'}`}
                        title={isTaskCreator ? (s.assigned_to ? `Assigned to ${s.assigned_employee?.full_name || 'Unknown'}` : 'Assign sub-step') : '🔒 Only task creator can assign sub-steps'}>
                        <Users className="w-3 h-3" />
                        {s.assigned_to && <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">1</div>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowHistoryForSubStep(s.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-purple-600 relative" title="History & Blockers">
                        <History className="w-3 h-3" />
                        {historyCounts[s.id] ? <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{historyCounts[s.id]}</div> : null}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => isTaskCreator && startEdit(s.id, s.title)} disabled={!isTaskCreator}
                        className={`h-6 w-6 p-0 ${isTaskCreator ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-300 opacity-40 cursor-not-allowed'}`}
                        title={isTaskCreator ? 'Edit sub-step' : '🔒 Only task creator can edit sub-steps'}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => isTaskCreator && deleteSubStep(s.id)} disabled={!isTaskCreator}
                        className={`h-6 w-6 p-0 ${isTaskCreator ? 'text-gray-400 hover:text-red-600 cursor-pointer' : 'text-gray-300 opacity-40 cursor-not-allowed'}`}
                        title={isTaskCreator ? 'Delete sub-step' : '🔒 Only task creator can delete sub-steps'}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
										</div>
									</>
								)}
							</li>
              )
						)}
						</ul>
				)}
				</div>
        </div>

        <div className={cn('px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30', isMobile ? '' : 'px-6 pt-4 pb-4')}>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full md:w-auto">
              Close
            </Button>
          </div>
        </div>
        {showHistoryForSubStep && (
          <StepHistoryModal
            isOpen={!!showHistoryForSubStep}
            onClose={() => setShowHistoryForSubStep(null)}
            taskStepId={parentStepId}
            stepTitle={parentStepTitle}
            currentStatus={'pending'}
            currentPriority={'medium'}
            subStepId={showHistoryForSubStep}
            onHistoryUpdate={async () => {
              // refresh count for this sub-step only
              try {
                const { count } = await supabase
                  .from('task_step_history')
                  .select('id', { count: 'exact', head: true })
                  .eq('task_steps_to_steps_id', showHistoryForSubStep);
                setHistoryCounts(prev => ({ ...prev, [showHistoryForSubStep]: count || 0 }));
              } catch (_) {}
            }}
          />
        )}

        {/* Assign Sub-Step Dialog */}
        {assignDialogSubStep && (
          <AssignSubStepDialog
            subStep={{
              id: assignDialogSubStep.id,
              title: assignDialogSubStep.title,
              parent_step_id: parentStepId, // NEW: pass parent step ID
              assigned_to: assignDialogSubStep.assigned_to,
              assigned_employee: assignDialogSubStep.assigned_employee
            }}
            onAssign={async (employeeId: string, dueDateIso: string) => {
              await handleAssignSubStep(assignDialogSubStep.id, employeeId, dueDateIso);
            }}
            onUnassign={async () => {
              await handleAssignSubStep(assignDialogSubStep.id, null);
            }}
            onClose={() => setAssignDialogSubStep(null)}
          />
        )}

        {/* Confirmation Dialog for Sub-Step Completion Toggle */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingSubStepCurrent !== null && !pendingSubStepCurrent 
                  ? 'Konfirmasi Menyelesaikan Sub-Step' 
                  : 'Konfirmasi Membuka Kembali Sub-Step'
                }
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingSubStepId && pendingSubStepCurrent !== null ? (
                  (() => {
                    const subStep = subSteps.find(s => s.id === pendingSubStepId);
                    const subStepTitle = subStep?.title || 'Sub-step ini';
                    return pendingSubStepCurrent === false
                      ? `Apakah Anda yakin ingin menandai sub-step "${subStepTitle}" sebagai selesai?`
                      : `Apakah Anda yakin ingin membuka kembali sub-step "${subStepTitle}"?`;
                  })()
                ) : (
                  'Apakah Anda yakin?'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowConfirmDialog(false);
                setPendingSubStepId(null);
                setPendingSubStepCurrent(null);
              }}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmToggleCompleted}>
                {pendingSubStepCurrent !== null && !pendingSubStepCurrent 
                  ? 'Ya, Selesaikan' 
                  : 'Ya, Buka Kembali'
                }
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>

    {useSwipeLayout && (
      <Dialog
        open={editDialogOpen && !!editingId}
        onOpenChange={(openState) => {
          if (!openState) {
            cancelEdit();
            setEditDialogOpen(false);
          }
        }}
      >
        <DialogContent
          className="max-w-[90vw] w-[320px] h-[320px] max-h-[85vh] gap-4 z-[60] flex flex-col"
          overlayClassName="z-[60]"
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{t('dailyTask.editSubStep.title', 'Edit sub-step')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <Textarea
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={t('dailyTask.editSubStep.placeholder', 'Sub-step title')}
              className="min-h-[140px] max-h-full w-full resize-none overflow-y-auto text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                  setEditDialogOpen(false);
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cancelEdit();
                setEditDialogOpen(false);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await saveEdit();
                setEditDialogOpen(false);
              }}
              disabled={!editTitle.trim()}
            >
              {t('common.save', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};



