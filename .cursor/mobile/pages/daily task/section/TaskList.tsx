import React, { useState, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { TooltipProvider } from '@/features/ui/tooltip';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { useDailyTask } from '@/features/8-2-DailyTask/DailyTaskContext';
import type { Task } from '@/features/8-2-DailyTask/types';
import { useCurrentUser } from '@/features/share/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/features/share/hooks/useCurrentEmployee';
import { useToast } from '@/features/ui/use-toast';
import { logger } from '@/config/logger';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { DeadlineExtensionDialog } from '@/features/8-2-DailyTask/section/DeadlineExtensionDialog';
import { DeadlineHistoryDialog } from '@/features/8-2-DailyTask/section/DeadlineHistoryDialog';
import { EditTaskDialog } from '@/features/8-2-DailyTask/section/EditTaskDialog';
import { CreateTaskDialog } from '@/features/8-2-DailyTask/section/CreateTaskDialog';
import { ModalAddTaskStep } from '@/features/8-2-DailyTask/section/ModalAddTaskStep';
import { BlockerDetailsModal } from '@/features/8-2-DailyTaskReport/components/BlockerDetailsModal';
import '@/features/8-2-DailyTask/section/TaskList.css';

// Hooks
import { useTaskModal } from './hooks/useTaskModal';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useBlockerCounts } from './hooks/useBlockerCounts';
import { useTaskBlockers } from './hooks/useTaskBlockers';

// Components
import { TaskCard } from './components/TaskCard';
import { EmptyState } from './components/EmptyState';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { TaskDetailModal } from './components/TaskDetailModal';

// Utils
import {
  isOverdue,
  getDaysRemaining,
  isTaskCreator as checkIsTaskCreator,
} from './utils/taskUtils';
import { getEffectiveProgressAndCount } from '@/features/8-2-DailyTask/utils/taskUtils';
import { getTaskCheckboxRule } from '@/features/8-2-DailyTask/utils/taskCheckboxRules';

export const TaskList = () => {
  const {
    tasks,
    filters,
    effectiveFilteredTasks,
    getVisibleStepsEffective,
    updateTask,
    deleteTask,
    reorderTaskSteps,
    highlightedTask,
    requestDeadlineExtension,
    departmentMap,
  } = useDailyTask();
  const { user } = useCurrentUser();
  const currentUserId = user?.id;
  const { data: currentEmployee } = useCurrentEmployee();
  const { toast } = useToast();
  const { t } = useAppTranslation();

  // Gunakan daftar terfilter dari context (satu sumber kebenaran: termasuk filter plan date / custom month)
  const filteredTasks = effectiveFilteredTasks;
  const getVisibleSteps = getVisibleStepsEffective;

  const calculateAssignedStepsProgress = useCallback(
    (task: Task): number => {
      const visibleSteps = getVisibleSteps(task);
      const { progress, totalCount } = getEffectiveProgressAndCount(visibleSteps);
      if (totalCount > 0) return progress;
      if (task.has_substeps === false && task.status === 'completed') return 100;
      if (task.has_substeps === false && task.status !== 'completed') return 0;
      return progress;
    },
    [getVisibleSteps]
  );

  const { activeTask, activeVisibleSteps, activeProgress, openTaskModal, closeTaskModal } =
    useTaskModal({
      tasks,
      getVisibleSteps,
      calculateProgress: calculateAssignedStepsProgress,
    });

  const { taskRefs } = useAutoScroll({ highlightedTaskId: highlightedTask });
  const { blockerCountByTask } = useBlockerCounts({ filteredTasks });
  const { blockerModalOpen, blockerModalItems, loadingBlockers, setBlockerModalOpen, openTaskBlockers } =
    useTaskBlockers({
      getVisibleSteps,
    });

  // Mobile: sort tasks by progress ascending (lowest at top, 100% at bottom)
  const sortedTasks = useMemo(
    () =>
      [...filteredTasks].sort(
        (a, b) => calculateAssignedStepsProgress(a) - calculateAssignedStepsProgress(b)
      ),
    [filteredTasks, calculateAssignedStepsProgress]
  );

  // State management
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);
  const [reminderPendingTaskId, setReminderPendingTaskId] = useState<string | null>(null);
  const [deadlineDialog, setDeadlineDialog] = useState<{ isOpen: boolean; taskId: string | null }>({
    isOpen: false,
    taskId: null,
  });
  const [historyDialog, setHistoryDialog] = useState<{ isOpen: boolean; taskId: string | null }>({
    isOpen: false,
    taskId: null,
  });
  const [addStepDialog, setAddStepDialog] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
  }>({ isOpen: false, taskId: null, taskTitle: '' });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
  }>({ isOpen: false, taskId: null, taskTitle: '' });
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [revealedTaskId, setRevealedTaskId] = useState<string | null>(null);

  // Computed values for active task
  const activeIsOverdue = activeTask ? isOverdue(activeTask.due_date, activeTask.status) : false;
  const activeDaysRemaining = activeTask
    ? getDaysRemaining(activeTask.due_date, activeTask.status)
    : null;
  const activeBlockerCount = activeTask ? blockerCountByTask[activeTask.id] || 0 : 0;

  // Handlers
  const isTaskCreator = useCallback(
    (task: Task) => checkIsTaskCreator(task, currentUserId),
    [currentUserId]
  );

  const handleStatusToggle = useCallback(
    (task: Task) => {
      const visibleSteps = getVisibleSteps(task);
      const { progress, totalCount } = getEffectiveProgressAndCount(visibleSteps);
      const progressPct =
        totalCount > 0
          ? progress
          : task.status === 'completed'
            ? 100
            : 0;
      const checkboxRule = getTaskCheckboxRule({
        task,
        progress: progressPct,
        visibleStepCount: visibleSteps.length,
      });

      // Tasks without steps can still be toggled manually.
      if (!checkboxRule.taskHasSteps) {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        if (newStatus !== task.status) {
          toast({
            title: newStatus === 'completed' ? t('dailyTask.taskCompleted', 'Task Completed') : t('dailyTask.taskReopened', 'Task Reopened'),
            description: `"${task.title}" has been ${newStatus === 'completed' ? 'marked as completed' : 'reopened'}`,
          });
          // Optimistic update: langsung update tanpa menunggu (updateTask sudah melakukan optimistic update di context)
          updateTask(task.id, { status: newStatus }).catch((err) => {
            logger.error('Error updating task status:', err);
            toast({
              title: 'Error',
              description: 'Failed to update task status',
              variant: 'destructive',
            });
          });
        }
        return;
      }

      // Tasks with steps are always step-driven and cannot be toggled manually.
      if (checkboxRule.isStepProgressFull) {
        toast({
          title: t('dailyTask.cannotUncheckTask', 'Cannot Uncheck Task'),
          description: t('dailyTask.cannotUncheckTaskDesc', 'Cannot uncheck task with steps. Please manage steps individually.'),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('dailyTask.cannotCompleteTask', 'Cannot Complete Task'),
        description: t('dailyTask.completeAllStepsFirst', 'Please complete all assigned steps first'),
        variant: 'destructive',
      });
    },
    [getVisibleSteps, toast, updateTask, t]
  );

  const handlePriorityChange = useCallback(
    async (taskId: string, newPriority: Task['priority']) => {
      updateTask(taskId, { priority: newPriority }).catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to update priority',
          variant: 'destructive',
        });
      });
    },
    [updateTask, toast]
  );

  const handleDeleteClick = useCallback((task: Task) => {
    setDeleteDialog({
      isOpen: true,
      taskId: task.id,
      taskTitle: task.title,
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.taskId) return;
    try {
      await deleteTask(deleteDialog.taskId);
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  }, [deleteDialog.taskId, deleteTask, toast]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  }, []);

  const handleToggleReminder = useCallback(
    async (task: Task) => {
      const currentValue = task.has_reminder ?? false;
      const newReminderValue = !currentValue;

      // Jika ingin mengaktifkan reminder tapi belum ada due_date, buka date picker dulu
      if (newReminderValue && !task.due_date) {
        setReminderPendingTaskId(task.id);
        setDatePickerOpen(task.id);
        return;
      }

      updateTask(task.id, { has_reminder: newReminderValue }).catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to update reminder',
          variant: 'destructive',
        });
      });
    },
    [updateTask, toast]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      // Extract step IDs from the drag event
      const activeId = active.id as string;
      const overId = over.id as string;

      // Check if we're reordering steps within a task
      if (activeId.startsWith('step-') && overId.startsWith('step-')) {
        const activeStepId = activeId.replace('step-', '');
        const overStepId = overId.replace('step-', '');

        // Find the task that contains these steps
        const task = tasks.find(
          (t) =>
            (t.steps ?? []).some((s) => s.id === activeStepId) && (t.steps ?? []).some((s) => s.id === overStepId)
        );

        if (task) {
          // Get the steps in their current order (copy to avoid mutating context state)
          const sortedSteps = [...(task.steps ?? [])].sort((a, b) => a.order - b.order);
          const activeIndex = sortedSteps.findIndex((s) => s.id === activeStepId);
          const overIndex = sortedSteps.findIndex((s) => s.id === overStepId);

          if (activeIndex !== -1 && overIndex !== -1) {
            // Create new order array
            const newSteps = [...sortedSteps];
            const [removed] = newSteps.splice(activeIndex, 1);
            newSteps.splice(overIndex, 0, removed);

            // Extract step IDs in new order
            const stepIds = newSteps.map((step) => step.id);

            // Call reorder function
            reorderTaskSteps(task.id, stepIds).catch(() => {
              toast({
                title: 'Error',
                description: 'Failed to reorder steps',
                variant: 'destructive',
              });
            });
          }
        }
      }
    },
    [tasks, reorderTaskSteps, toast]
  );

  // Key so list remounts when date/plan filter changes (avoids stale DOM when filter updates)
  const listKey = [
    filters.dateRange ?? '',
    filters.planDateRange ?? '',
    filters.customPlanMonth ?? '',
    filters.customStartDate ?? '',
    filters.customEndDate ?? '',
  ].join('|');

  return (
    <div className="flex flex-col mobile-task-list">
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <TooltipProvider>
          <div className="flex flex-col">
            <div key={listKey} className="space-y-1">
              {sortedTasks.length === 0 ? (
                <EmptyState />
              ) : (
                sortedTasks.map((task) => {
                  const isHighlighted = highlightedTask === task.id;
                  const visibleSteps = getVisibleSteps(task);
                  const { progress, completedCount, totalCount } = getEffectiveProgressAndCount(visibleSteps);
                  // Use effective progress when we have steps (so bar matches badge); else fallback by status
                  const progressPct = totalCount > 0
                    ? progress
                    : (task.has_substeps === false ? (task.status === 'completed' ? 100 : 0) : progress);
                  const blockerCount = blockerCountByTask[task.id] || 0;

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isHighlighted={isHighlighted}
                      visibleSteps={visibleSteps}
                      progress={progressPct}
                      completedCount={completedCount}
                      totalCount={totalCount}
                      blockerCount={blockerCount}
                      isTaskCreator={isTaskCreator(task)}
                      department={departmentMap[task.id]}
                      onToggleStatus={handleStatusToggle}
                      onOpenModal={openTaskModal}
                      onToggleReminder={handleToggleReminder}
                      onViewBlockers={openTaskBlockers}
                      onRequestExtension={(task) =>
                        setDeadlineDialog({ isOpen: true, taskId: task.id })
                      }
                      onEdit={(task) => setEditingTask(task.id)}
                      onDelete={handleDeleteClick}
                      taskRef={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      isRevealed={revealedTaskId === task.id}
                      onReveal={() => setRevealedTaskId(task.id)}
                      onClose={() => setRevealedTaskId(null)}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Dialogs */}
          <DeadlineExtensionDialog
            isOpen={deadlineDialog.isOpen}
            onClose={() => setDeadlineDialog({ isOpen: false, taskId: null })}
            taskId={deadlineDialog.taskId}
            currentDeadline={
              deadlineDialog.taskId
                ? tasks.find((t) => t.id === deadlineDialog.taskId)?.due_date || null
                : null
            }
            onRequestExtension={requestDeadlineExtension}
          />

          <DeadlineHistoryDialog
            isOpen={historyDialog.isOpen}
            onClose={() => setHistoryDialog({ isOpen: false, taskId: null })}
            taskId={historyDialog.taskId}
            deadlineHistory={
              historyDialog.taskId
                ? tasks.find((t) => t.id === historyDialog.taskId)?.deadline_history || []
                : []
            }
          />

          <EditTaskDialog
            isOpen={editingTask !== null}
            onClose={() => setEditingTask(null)}
            taskId={editingTask}
          />

          {addStepDialog.taskId && (
            <ModalAddTaskStep
              open={addStepDialog.isOpen}
              onOpenChange={(open) =>
                setAddStepDialog({ isOpen: open, taskId: null, taskTitle: '' })
              }
              taskId={addStepDialog.taskId}
              taskTitle={addStepDialog.taskTitle}
              onSuccess={() => {
                // Optionally refresh or do something after success
              }}
            />
          )}

          <DeleteTaskDialog
            isOpen={deleteDialog.isOpen}
            taskTitle={deleteDialog.taskTitle}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />

          <BlockerDetailsModal
            open={blockerModalOpen}
            onOpenChange={setBlockerModalOpen}
            items={blockerModalItems}
            initialTab={'list'}
            loading={loadingBlockers}
          />

          {activeTask && (
            <TaskDetailModal
              task={activeTask}
              visibleSteps={activeVisibleSteps}
              progress={activeProgress}
              isOverdue={activeIsOverdue}
              daysRemaining={activeDaysRemaining}
              blockerCount={activeBlockerCount}
              userId={currentUserId}
              onClose={closeTaskModal}
              onToggleReminder={handleToggleReminder}
              onViewBlockers={openTaskBlockers}
              onViewHistory={(taskId) => setHistoryDialog({ isOpen: true, taskId })}
              onRequestExtension={(taskId) => setDeadlineDialog({ isOpen: true, taskId })}
              onEdit={(taskId) => setEditingTask(taskId)}
              onDelete={handleDeleteClick}
              onPriorityChange={handlePriorityChange}
              onAddStep={(taskId, taskTitle) =>
                setAddStepDialog({ isOpen: true, taskId, taskTitle })
              }
            />
          )}

          <div className="pointer-events-none fixed left-0 right-0 z-50 flex justify-end px-6 fixed-above-nav-safe">
            <Button
              onClick={() => setIsCreateTaskDialogOpen(true)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              {t('dailyTask.addTask', 'Add Task')}
            </Button>
          </div>

          <CreateTaskDialog
            open={isCreateTaskDialogOpen}
            onOpenChange={setIsCreateTaskDialogOpen}
          />
        </TooltipProvider>
      </DndContext>
    </div>
  );
};
