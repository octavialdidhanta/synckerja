import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, Target, User, UserPlus, Calendar, Bell, AlertTriangle, Clock3, Edit, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/ui/tooltip';
import type { Task, TaskStep as TaskStepEntity } from '@/features/8-2-DailyTask/types';
import { formatDate, isOverdue } from '../utils/taskUtils';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { getTaskCheckboxRule } from '@/features/8-2-DailyTask/utils/taskCheckboxRules';

const ACTION_STRIP_WIDTH = 140;
const SWIPE_THRESHOLD = 28;
const DIRECTION_LOCK_PX = 8;
const DIRECTION_LOCK_PX_WHEN_OPEN = 4;
const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';

interface TaskCardProps {
  task: Task;
  isHighlighted: boolean;
  visibleSteps: TaskStepEntity[];
  progress: number;
  /** Effective completed/total count (considers sub-steps); when provided, badge shows this instead of step-only count */
  completedCount?: number;
  totalCount?: number;
  blockerCount?: number;
  /** Department for this task (same as desktop – from departmentMap). */
  department?: { id: string; name: string } | undefined;
  isTaskCreator: boolean;
  onToggleStatus: (task: Task) => void;
  onOpenModal: (taskId: string) => void;
  onToggleReminder: (task: Task) => void;
  onViewBlockers: (task: Task) => void;
  onRequestExtension: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  taskRef?: (el: HTMLDivElement | null) => void;
  /** When provided, swipe-to-reveal is enabled: actions move to strip, close by swiping right */
  isRevealed?: boolean;
  onReveal?: () => void;
  onClose?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isHighlighted,
  visibleSteps,
  progress,
  completedCount,
  totalCount,
  blockerCount = 0,
  department,
  isTaskCreator,
  onToggleStatus,
  onOpenModal,
  onToggleReminder,
  onViewBlockers,
  onRequestExtension,
  onEdit,
  onDelete,
  taskRef,
  isRevealed = false,
  onReveal,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const isOverdueTask = isOverdue(task.due_date, task.status);
  const checkboxRule = getTaskCheckboxRule({
    task,
    progress,
    visibleStepCount: visibleSteps.length,
  });
  // Keep visual parity with desktop: title is crossed out whenever displayed progress is 100%.
  const isCompleted = checkboxRule.isChecked || progress >= 100;

  const [translateX, setTranslateX] = useState(0);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const translateXRef = useRef(0);
  const slidingCardRef = useRef<HTMLDivElement>(null);
  const lockHorizontalRef = useRef(false);

  const hasSwipe = onReveal != null && onClose != null;

  /** Sync ref from state only when not mid-gesture (same fix as MobileTaskStep) */
  if (touchStartRef.current == null) translateXRef.current = translateX;
  lockHorizontalRef.current =
    touchStartRef.current?.lockHorizontal === true;

  // Non-passive touchmove so we can preventDefault when swiping horizontally (stops page scroll)
  useEffect(() => {
    if (!hasSwipe || !slidingCardRef.current) return;
    const el = slidingCardRef.current;
    const onMove = (e: TouchEvent) => {
      if (lockHorizontalRef.current && e.cancelable) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [hasSwipe]);

  // When parent says this card is no longer revealed (e.g. another card opened), close it
  useEffect(() => {
    if (hasSwipe && !isRevealed && translateX !== 0) {
      setTranslateX(0);
      translateXRef.current = 0;
    }
  }, [hasSwipe, isRevealed, translateX]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasSwipe) return;
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateX,
      lockHorizontal: null,
    };
    setIsDragging(true);
    const el = slidingCardRef.current;
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
      const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
      translateXRef.current = next;
      const el = slidingCardRef.current;
      if (el) el.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!hasSwipe) return;
    const start = touchStartRef.current;
    const el = slidingCardRef.current;
    lockHorizontalRef.current = false;
    touchStartRef.current = null;
    /** Read current before any state/DOM change */
    const current = translateXRef.current;
    const wasOpen = start != null && start.startTranslateX < -SWIPE_THRESHOLD;
    const closedBySwipe = wasOpen && current > -SWIPE_THRESHOLD;
    const openedBySwipe = current < -SWIPE_THRESHOLD && !closedBySwipe;
    const targetX = openedBySwipe ? -ACTION_STRIP_WIDTH : 0;

    /** Update ref and state immediately so next render has correct values */
    translateXRef.current = targetX;
    setIsDragging(false);
    setTranslateX(targetX);

    /** Apply snap synchronously so transition runs from current position before React overwrites style */
    if (el) {
      el.style.transition = SNAP_TRANSITION;
      el.style.transform = `translateX(${targetX}px)`;
    }

    if (openedBySwipe) {
      onReveal?.();
    } else if (wasOpen || current !== 0) {
      /** Only notify close when strip was open or we actually moved (avoids no-op setState in parent) */
      onClose?.();
    }
  };

  const cardContent = (
    <div
      ref={hasSwipe ? slidingCardRef : undefined}
      className={`flex flex-col gap-1.5 rounded-lg border border-blue-100 bg-white p-3 shadow-sm transition-all duration-300 ${
        isHighlighted ? 'bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-blue-50'
      }`}
      style={
        hasSwipe
          ? {
              ...(isDragging
                ? {}
                : {
                    transform: `translateX(${translateX}px)`,
                    transition: SNAP_TRANSITION,
                  }),
              ...(isDragging ? { willChange: 'transform' as const } : {}),
              touchAction: 'pan-y',
            }
          : undefined
      }
      onTouchStart={hasSwipe ? handleTouchStart : undefined}
      onTouchMove={hasSwipe ? handleTouchMove : undefined}
      onTouchEnd={hasSwipe ? handleTouchEnd : undefined}
      onTouchCancel={hasSwipe ? handleTouchEnd : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleStatus(task);
          }}
          disabled={checkboxRule.isDisabled}
          className={`mt-1 flex-shrink-0 transition-colors ${
            checkboxRule.isDisabled
              ? 'text-gray-300 cursor-not-allowed opacity-50'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={
            checkboxRule.taskHasSteps
              ? checkboxRule.reasonKey === 'completeAllStepsFirst'
                ? t('dailyTask.completeAllStepsFirst', 'Please complete all assigned steps first')
                : t('dailyTask.cannotUncheckTaskDesc', 'Cannot uncheck task with steps. Please manage steps individually.')
              : task.status === 'completed'
                ? 'Mark incomplete'
                : 'Mark complete'
          }
        >
          {isCompleted ? (
            <CheckSquare className="h-4 w-4 text-green-600" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onOpenModal(task.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`flex-1 min-w-0 truncate text-left text-[13px] font-semibold leading-5 transition-colors ${
                    isCompleted
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                    {isHighlighted && (
                      <Target className="h-4 w-4 text-primary animate-pulse" />
                    )}
                    <span className="truncate">{task.title}</span>
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-md border border-slate-700 bg-slate-900 p-4 text-white shadow-lg"
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {task.title}
                </p>
                {task.description && (
                  <p className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-300">
                    {task.description}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      <div
        className="w-full cursor-pointer"
        onClick={() => onOpenModal(task.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenModal(task.id);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 w-full text-[11px] text-muted-foreground cursor-pointer"
        onClick={() => onOpenModal(task.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenModal(task.id);
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" />
            {completedCount != null && totalCount != null
              ? `${completedCount}/${totalCount}`
              : `${visibleSteps.filter((s) => s.is_completed).length}/${visibleSteps.length}`}
          </span>
          {department && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
              <span className="max-w-[120px] truncate text-[11px] text-muted-foreground" title={department.name}>
                {department.name}
              </span>
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-foreground min-w-0 max-w-full">
                <User className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                {task.assigned_to_name ? (
                  <span className="inline-flex items-center gap-1 min-w-0 max-w-[min(100%,280px)] flex-wrap">
                    <span
                      className="max-w-[120px] truncate text-[11px] text-muted-foreground"
                      title={task.assigned_to_name}
                    >
                      {task.assigned_to_name}
                    </span>
                    {task.assigned_by_name ? (
                      <>
                        <UserPlus
                          className="h-3 w-3 shrink-0 text-slate-400"
                          aria-hidden
                        />
                        <span
                          className="max-w-[120px] truncate text-[11px] text-muted-foreground"
                          title={t('dailyTask.picAssignedByTooltip', 'Assigned by {{name}}', {
                            name: task.assigned_by_name,
                          })}
                        >
                          {task.assigned_by_name}
                        </span>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground text-[11px]">
                    {t('dailyTask.picUnassigned', 'Unassigned')}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            {(task.assigned_to_name || task.assigned_by_name) && (
              <TooltipContent className="max-w-xs">
                {task.assigned_to_name && <div>{task.assigned_to_name}</div>}
                {task.assigned_by_name && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('dailyTask.picAssignedByTooltip', 'Assigned by {{name}}', {
                      name: task.assigned_by_name,
                    })}
                  </div>
                )}
              </TooltipContent>
            )}
          </Tooltip>
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 ${
                isOverdueTask ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {/* Action icons only visible when NOT using swipe (e.g. desktop); on mobile they are in the action strip */}
        {!hasSwipe && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReminder(task);
              }}
              className={`h-6 w-6 p-0 ${
                task.has_reminder ?? false
                  ? 'text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
              title={
                task.has_reminder ?? false
                  ? 'Pengingat aktif'
                  : task.due_date
                  ? 'Aktifkan pengingat'
                  : 'Set due date terlebih dahulu untuk mengaktifkan pengingat'
              }
            >
              <Bell
                className={`h-3.5 w-3.5 ${
                  task.has_reminder ?? false ? 'fill-current' : ''
                }`}
              />
            </Button>
            {blockerCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewBlockers(task);
                }}
                className="h-6 w-6 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                title="View blockers"
              >
                <AlertTriangle className="h-3 w-3" />
              </Button>
            )}
            {task.due_date && task.status !== 'completed' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestExtension(task);
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:bg-orange-50 hover:text-orange-600"
                title="Request deadline extension"
              >
                <Clock3 className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                isTaskCreator && onEdit(task);
              }}
              disabled={!isTaskCreator}
              className={`h-6 w-6 p-0 ${
                isTaskCreator
                  ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-600'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              title={isTaskCreator ? 'Edit task' : '🔒 Only task creator can edit'}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (isTaskCreator) {
                  onDelete(task);
                }
              }}
              disabled={!isTaskCreator}
              className={`h-6 w-6 p-0 ${
                isTaskCreator
                  ? 'cursor-pointer hover:bg-red-50 hover:text-red-600'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              title={isTaskCreator ? 'Delete task' : '🔒 Only task creator can delete'}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (!hasSwipe) {
    return (
      <div ref={taskRef}>
        {cardContent}
      </div>
    );
  }

  const actionStrip = (
    <div
      className="absolute right-0 top-0 bottom-0 flex-shrink-0 flex items-stretch rounded-r-lg border-l-2 border-slate-300 bg-slate-200 overflow-hidden"
      style={{ width: ACTION_STRIP_WIDTH }}
    >
      <div className="flex items-center flex-1 min-w-0 border-r-2 border-slate-300 bg-amber-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleReminder(task);
          }}
          className={`h-full w-full min-w-0 rounded-none border-0 border-transparent ${
            task.has_reminder ?? false
              ? 'text-amber-900 bg-amber-400 hover:bg-amber-500 hover:text-amber-950'
              : 'text-amber-800 hover:bg-amber-400 hover:text-amber-900'
          }`}
          title={
            task.has_reminder ?? false
              ? 'Pengingat aktif'
              : task.due_date
              ? 'Aktifkan pengingat'
              : 'Set due date terlebih dahulu untuk mengaktifkan pengingat'
          }
        >
          <Bell
            className={`h-4 w-4 ${
              task.has_reminder ?? false ? 'fill-current' : ''
            }`}
          />
        </Button>
      </div>
      {blockerCount > 0 && (
        <div className="flex items-center flex-1 min-w-0 border-r-2 border-slate-300 bg-orange-300">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onViewBlockers(task);
            }}
            className="h-full w-full min-w-0 rounded-none border-0 border-transparent text-orange-900 hover:bg-orange-400 hover:text-orange-950"
            title="View blockers"
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        </div>
      )}
      {task.due_date && task.status !== 'completed' && (
        <div className="flex items-center flex-1 min-w-0 border-r-2 border-slate-300 bg-sky-300">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRequestExtension(task);
            }}
            className="h-full w-full min-w-0 rounded-none border-0 border-transparent text-sky-900 hover:bg-sky-400 hover:text-sky-950"
            title="Request deadline extension"
          >
            <Clock3 className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-center flex-1 min-w-0 border-r-2 border-slate-300 bg-blue-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            isTaskCreator && onEdit(task);
          }}
          disabled={!isTaskCreator}
          className={`h-full w-full min-w-0 rounded-none border-0 border-transparent ${
            isTaskCreator
              ? 'text-blue-900 hover:bg-blue-400 hover:text-blue-950'
              : 'opacity-40 cursor-not-allowed text-blue-900'
          }`}
          title={isTaskCreator ? 'Edit task' : '🔒 Only task creator can edit'}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center flex-1 min-w-0 bg-red-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            if (isTaskCreator) {
              onDelete(task);
            }
          }}
          disabled={!isTaskCreator}
          className={`h-full w-full min-w-0 rounded-none border-0 border-transparent ${
            isTaskCreator
              ? 'text-red-900 hover:bg-red-400 hover:text-red-950'
              : 'opacity-40 cursor-not-allowed text-red-900'
          }`}
          title={isTaskCreator ? 'Delete task' : '🔒 Only task creator can delete'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div
      ref={taskRef}
      className="relative overflow-hidden rounded-lg"
    >
      {actionStrip}
      <div className="min-w-0 flex-1" style={{ minWidth: '100%' }}>
        {cardContent}
      </div>
    </div>
  );
};
