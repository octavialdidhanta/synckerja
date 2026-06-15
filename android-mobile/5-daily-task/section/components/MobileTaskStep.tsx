import React, { useState, useRef, useEffect } from 'react';
import { ListChecks, Paperclip, Link, Users, History, Edit, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/shared/components/ui/button';
import { TaskStep as TaskStepItem, type TaskStepHandle } from '@/8-2-DailyTask/section/TaskStep';
import type { TaskStep as TaskStepEntity } from '@/8-2-DailyTask/context/DailyTaskContext';

const ACTION_STRIP_WIDTH = 280;
const SWIPE_THRESHOLD = 36;
/** Finger must release with panel at least this far left to snap open from closed (stricter than close threshold). */
const SWIPE_OPEN_COMMIT_PX = 52;
const DIRECTION_LOCK_PX = 10;
/** Saat strip terbuka, lock horizontal lebih cepat agar geser kanan (tutup) mudah */
const DIRECTION_LOCK_PX_WHEN_OPEN = 4;
/** Same gesture thresholds as `TaskCard` (task list swipe-to-reveal). */
const MIN_SWIPE_MOVEMENT = 36;
/** If finger lifts within this distance from where it started, treat as tap (do not snap strip open) */
const TAP_MOVE_MAX = 14;
/** Require this many `touchmove` updates while horizontally locked before snap-open (modal + scroll produces extra moves). */
const MIN_HORIZONTAL_MOVES_TO_OPEN = 5;
/** Ignore swipe tracking when touch starts on native controls (checkbox tap was still bubbling into row swipe). */
const TOUCH_IGNORE_SWIPE = 'button, a, input, textarea, label, [role="checkbox"]';
/** Opening strip from cold needs a slightly longer gesture than a tap (ms). */
const MIN_GESTURE_MS_TO_OPEN = 140;

/** Min width per segment so icons aren't cramped; 8 segments × 35px ≈ 280 */
const SEGMENT_MIN_WIDTH = 35;

const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';
/** Smooth transition when item settles after drop (reorder) */
const SORT_DROP_TRANSITION = 'transform 0.38s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s ease-out';

interface MobileTaskStepProps {
  step: TaskStepEntity;
  index: number;
  taskCreatedBy?: string;
  taskAssignedTo?: string | null;
  taskTitle?: string;
  autoReorder?: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  onSubStepModalOpenChange?: (open: boolean) => void;
  closeSubStepRequested?: number;
  mobileDescriptionExpanded?: boolean;
  onMobileDescriptionExpandedChange?: (expanded: boolean) => void;
}

export const MobileTaskStep: React.FC<MobileTaskStepProps> = ({
  step,
  index,
  taskCreatedBy,
  taskAssignedTo,
  taskTitle = '',
  autoReorder = false,
  isRevealed,
  onReveal,
  onClose,
  onSubStepModalOpenChange,
  closeSubStepRequested,
  mobileDescriptionExpanded,
  onMobileDescriptionExpandedChange,
}) => {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
    attributes,
    listeners,
  } = useSortable({ id: `step-${step.id}` });
  const stepRef = useRef<TaskStepHandle>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
    /** True after finger moved left by at least MIN_SWIPE_MOVEMENT from touch start (open intent only) */
    didSwipe: boolean;
    startedAt: number;
  } | null>(null);
  const translateXRef = useRef(0);
  const slidingRowRef = useRef<HTMLDivElement>(null);
  const lockHorizontalRef = useRef(false);
  const horizontalMoveFramesRef = useRef(0);

  /** Sync ref from state only when not mid-gesture (prevents re-render from wiping drag value) */
  if (touchStartRef.current == null) translateXRef.current = translateX;
  lockHorizontalRef.current = touchStartRef.current?.lockHorizontal === true;

  useEffect(() => {
    if (!slidingRowRef.current) return;
    const el = slidingRowRef.current;
    const onMove = (e: TouchEvent) => {
      if (lockHorizontalRef.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  useEffect(() => {
    if (!isRevealed && translateX !== 0) {
      setTranslateX(0);
      translateXRef.current = 0;
    }
  }, [isRevealed, translateX]);

  /** Close action strip when description expands — swipe disabled while reading. */
  useEffect(() => {
    if (!mobileDescriptionExpanded) return;
    if (translateXRef.current !== 0) {
      translateXRef.current = 0;
      setTranslateX(0);
      const el = slidingRowRef.current;
      if (el) {
        el.style.transition = SNAP_TRANSITION;
        el.style.transform = 'translateX(0px)';
      }
    }
    if (isRevealed) {
      onClose();
    }
  }, [mobileDescriptionExpanded, isRevealed, onClose]);

  /** Touch swipe logic aligned with `TaskCard` (task list), with stricter open rules inside modal/scroll. */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (mobileDescriptionExpanded) {
      touchStartRef.current = null;
      return;
    }
    const elTarget = e.target;
    if (elTarget instanceof Element && elTarget.closest(TOUCH_IGNORE_SWIPE)) {
      touchStartRef.current = null;
      return;
    }
    horizontalMoveFramesRef.current = 0;
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateX,
      lockHorizontal: null,
      didSwipe: false,
      startedAt: Date.now(),
    };
    setIsDragging(true);
    const el = slidingRowRef.current;
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
        /** Strip sudah terbuka: geser kanan untuk tutup — lock horizontal cepat agar tidak nyangkut */
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
      horizontalMoveFramesRef.current += 1;
      const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
      if (deltaX <= -MIN_SWIPE_MOVEMENT) start.didSwipe = true;
      translateXRef.current = next;
      const el = slidingRowRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    const el = slidingRowRef.current;
    lockHorizontalRef.current = false;
    if (!start) {
      horizontalMoveFramesRef.current = 0;
      setIsDragging(false);
      return;
    }
    touchStartRef.current = null;
    const horizontalMoves = horizontalMoveFramesRef.current;
    horizontalMoveFramesRef.current = 0;

    let endX = start.startX;
    let endY = start.startY;
    const ct = e.changedTouches?.[0];
    if (ct) {
      endX = ct.clientX;
      endY = ct.clientY;
    }
    const totalDx = endX - start.startX;
    const totalDy = endY - start.startY;
    const isTapLike =
      Math.abs(totalDx) < TAP_MOVE_MAX && Math.abs(totalDy) < TAP_MOVE_MAX;

    /** Read current position before any state update so re-render cannot overwrite ref */
    const current = translateXRef.current;
    const wasOpen = start.startTranslateX < -SWIPE_THRESHOLD;
    const closedBySwipe = wasOpen && current > -SWIPE_THRESHOLD;
    const gestureMs = Date.now() - start.startedAt;
    let openedBySwipe =
      start.didSwipe === true &&
      current <= -SWIPE_OPEN_COMMIT_PX &&
      !closedBySwipe;
    if (isTapLike) openedBySwipe = false;
    if (!wasOpen && horizontalMoves < MIN_HORIZONTAL_MOVES_TO_OPEN) openedBySwipe = false;
    if (!wasOpen && gestureMs < MIN_GESTURE_MS_TO_OPEN) openedBySwipe = false;

    let targetX = 0;
    if (openedBySwipe) {
      targetX = -ACTION_STRIP_WIDTH;
    } else if (wasOpen) {
      if (closedBySwipe || isTapLike) targetX = 0;
      else targetX = -ACTION_STRIP_WIDTH;
    } else {
      targetX = 0;
    }

    /** Apply target + transition immediately so both open and close use same smooth snap */
    if (el) {
      el.style.transition = SNAP_TRANSITION;
      el.style.transform = `translateX(${targetX}px)`;
    }
    translateXRef.current = targetX;
    setIsDragging(false);
    setTranslateX(targetX);
    if (openedBySwipe) {
      onReveal();
    } else if (targetX === 0) {
      onClose();
    }
  };

  const actionStrip = (
    <div
      className="absolute right-0 top-0 bottom-0 z-0 flex-shrink-0 flex items-stretch rounded-r-md border-l-2 border-slate-300 bg-slate-200 overflow-hidden"
      style={{ width: ACTION_STRIP_WIDTH }}
    >
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-amber-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.openSubSteps(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-amber-900 hover:bg-amber-400 hover:text-amber-950"
          title="View steps"
        >
          <ListChecks className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-sky-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.toggleFiles(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-sky-900 hover:bg-sky-400 hover:text-sky-950"
          title="Toggle files"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-teal-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.toggleLinks(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-teal-900 hover:bg-teal-400 hover:text-teal-950"
          title="Toggle links"
        >
          <Link className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-blue-200 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.openAssign(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-blue-900 hover:bg-blue-300 hover:text-blue-950"
          title="Assign step"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-purple-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.openHistory(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-purple-900 hover:bg-purple-400 hover:text-purple-950"
          title="View history"
        >
          <History className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 border-r-2 border-slate-300 bg-blue-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.openEdit(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-blue-900 hover:bg-blue-400 hover:text-blue-950"
          title="Edit step"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center flex-1 bg-red-300 px-1" style={{ minWidth: SEGMENT_MIN_WIDTH }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); stepRef.current?.openDelete(); }}
          className="h-8 w-8 min-w-8 min-h-8 rounded-none border-0 border-transparent text-red-900 hover:bg-red-400 hover:text-red-950"
          title="Delete step"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isSortDragging ? 'none' : (transition || SORT_DROP_TRANSITION),
        /** Keep row opaque: nested dialog + sortable often flashes `isDragging` on tap, which looked like "transparent" step. */
        opacity: 1,
      }}
      className="relative isolate overflow-hidden rounded-lg bg-white"
      data-step-id={step.id}
    >
      {actionStrip}
      <div
        ref={slidingRowRef}
        className="relative z-[1] min-h-0 w-full min-w-full bg-white"
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: mobileDescriptionExpanded ? 'auto' : 'pan-y',
          ...(isDragging
            ? { transition: 'none', willChange: 'transform' as const }
            : { transition: SNAP_TRANSITION }),
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <TaskStepItem
          ref={stepRef}
          contentOnly
          step={step}
          index={index}
          taskCreatedBy={taskCreatedBy}
          taskAssignedTo={taskAssignedTo}
          taskTitle={taskTitle}
          autoReorder={autoReorder}
          onSubStepModalOpenChange={onSubStepModalOpenChange}
          closeSubStepRequested={closeSubStepRequested}
          sortableHandleProps={{ attributes, listeners }}
          mobileDescriptionExpanded={mobileDescriptionExpanded}
          onMobileDescriptionExpandedChange={onMobileDescriptionExpandedChange}
        />
      </div>
    </div>
  );
};
