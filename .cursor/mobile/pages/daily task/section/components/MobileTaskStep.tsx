import React, { useState, useRef, useEffect } from 'react';
import { ListChecks, Paperclip, Link, Users, History, Edit, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/features/ui/button';
import { TaskStep as TaskStepItem, type TaskStepHandle } from '@/features/8-2-DailyTask/section/TaskStep';
import type { TaskStep as TaskStepEntity } from '@/features/8-2-DailyTask/DailyTaskContext';

const ACTION_STRIP_WIDTH = 280;
const SWIPE_THRESHOLD = 28;
const DIRECTION_LOCK_PX = 8;
/** Saat strip terbuka, lock horizontal lebih cepat agar geser kanan (tutup) mudah */
const DIRECTION_LOCK_PX_WHEN_OPEN = 4;
/** Minimum horizontal movement (px) to count as swipe — prevents tap/click from revealing strip */
const MIN_SWIPE_MOVEMENT = 24;

/** Min width per segment so icons aren't cramped; 8 segments × 35px ≈ 280 */
const SEGMENT_MIN_WIDTH = 35;

const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';
/** Smooth transition when item settles after drop (reorder) */
const SORT_DROP_TRANSITION = 'transform 0.38s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s ease-out';

interface MobileTaskStepProps {
  step: TaskStepEntity;
  index: number;
  taskCreatedBy?: string;
  taskTitle?: string;
  autoReorder?: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  onSubStepModalOpenChange?: (open: boolean) => void;
  closeSubStepRequested?: number;
}

export const MobileTaskStep: React.FC<MobileTaskStepProps> = ({
  step,
  index,
  taskCreatedBy,
  taskTitle = '',
  autoReorder = false,
  isRevealed,
  onReveal,
  onClose,
  onSubStepModalOpenChange,
  closeSubStepRequested,
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
    /** True after user has moved finger horizontally past MIN_SWIPE_MOVEMENT (so tap/click does not reveal) */
    didSwipe: boolean;
  } | null>(null);
  const translateXRef = useRef(0);
  const slidingRowRef = useRef<HTMLDivElement>(null);
  const lockHorizontalRef = useRef(false);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateX,
      lockHorizontal: null,
      didSwipe: false,
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
      const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
      if (Math.abs(deltaX) >= MIN_SWIPE_MOVEMENT) start.didSwipe = true;
      translateXRef.current = next;
      const el = slidingRowRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    const el = slidingRowRef.current;
    lockHorizontalRef.current = false;
    touchStartRef.current = null;
    /** Read current position before any state update so re-render cannot overwrite ref */
    const current = translateXRef.current;
    /** Strip was open at touch start (user might be swiping right to close) */
    const wasOpen = start != null && start.startTranslateX < -SWIPE_THRESHOLD;
    /** User swiped right to close: released past threshold toward 0 */
    const closedBySwipe = wasOpen && current > -SWIPE_THRESHOLD;
    /** User swiped left to open: deliberate swipe and released past threshold */
    const openedBySwipe = start?.didSwipe === true && current < -SWIPE_THRESHOLD && !closedBySwipe;

    const targetX = openedBySwipe ? -ACTION_STRIP_WIDTH : 0;

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
    } else {
      onClose();
    }
  };

  const actionStrip = (
    <div
      className="absolute right-0 top-0 bottom-0 flex-shrink-0 flex items-stretch rounded-r-md border-l-2 border-slate-300 bg-slate-200 overflow-hidden"
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isSortDragging ? 'none' : (transition || SORT_DROP_TRANSITION),
        opacity: isSortDragging ? 0.5 : 1,
      }}
      className="relative overflow-hidden rounded-lg"
      data-step-id={step.id}
    >
      {actionStrip}
      <div
        ref={slidingRowRef}
        style={{
          minWidth: '100%',
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y',
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
          taskTitle={taskTitle}
          autoReorder={autoReorder}
          onSubStepModalOpenChange={onSubStepModalOpenChange}
          closeSubStepRequested={closeSubStepRequested}
          sortableHandleProps={{ attributes, listeners }}
        />
      </div>
    </div>
  );
};
