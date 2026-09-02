import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CheckSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/shared/components/ui/table';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { useDailyTask } from '../context/DailyTaskContext';
import { type Task } from '../types';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useToast } from '@/shared/components/ui/use-toast';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  TaskListTableHeader,
  TaskListRow,
  TaskListDialogs,
} from './TaskList/index';
import { useTaskListBlockers } from '../hooks/useTaskListBlockers';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { useIndividualObjectives } from '@/1-home/components/HomeOKRDashboard/modal/useIndividualObjectives';
import { getEffectiveProgressAndCount } from '../utils/taskUtils';
import { getTaskCheckboxRule } from '../utils/taskCheckboxRules';
import { sortTasksByTitle, type TaskTitleSortDirection } from '../utils/taskListSort';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import './TaskList.css';
import { hideScrollbarClassName } from '../lib/hideScrollbar';

export const TaskList = () => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const {
    tasks,
    effectiveFilteredTasks,
    getVisibleStepsEffective,
    filters,
    setFilters,
    refetchTasks,
    updateTask,
    deleteTask,
    reorderTaskSteps,
    expandedTasks,
    setExpandedTasks,
    highlightedTask,
    highlightFromPendingApproval,
    requestDeadlineExtension,
    departmentMap,
  } = useDailyTask();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const hasLinkedObjectives = useMemo(
    () => tasks.some((task) => Boolean(task.objective_id)),
    [tasks],
  );
  const okrOrgId = hasLinkedObjectives ? organizationId : undefined;
  const { data: cycles = [] } = useOkrCycles(okrOrgId);
  const activeCycleIds = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return cycles
      .filter(
        (c: { is_active?: boolean; year?: number }) =>
          (c as { is_active?: boolean }).is_active === true ||
          ((c as { year?: number }).year === currentYear || (c as { year?: number }).year === currentYear + 1)
      )
      .map((c: { id: string }) => c.id);
  }, [cycles]);
  const { data: individualObjectives = [] } = useIndividualObjectives(
    okrOrgId,
    activeCycleIds,
    Boolean(okrOrgId),
  );
  const objectiveIdToTitle = useMemo(() => {
    const map: Record<string, string> = {};
    individualObjectives.forEach((obj: { id: string; title: string }) => {
      map[obj.id] = obj.title;
    });
    return map;
  }, [individualObjectives]);

  const {
    blockerCountByTask,
    blockerModalOpen,
    setBlockerModalOpen,
    blockerModalItems,
    openTaskBlockers,
    fetchBlockerCountForTasks,
    blockerCountFetchedForRef,
  } = useTaskListBlockers(effectiveFilteredTasks, getVisibleStepsEffective);

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
  const [addTemplateDialog, setAddTemplateDialog] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
  }>({ isOpen: false, taskId: null, taskTitle: '' });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
  }>({ isOpen: false, taskId: null, taskTitle: '' });
  const [statusToggleDialog, setStatusToggleDialog] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
    nextStatus: 'completed' | 'pending';
  }>({ isOpen: false, taskId: null, taskTitle: '', nextStatus: 'pending' });
  const taskRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [titleSort, setTitleSort] = useState<TaskTitleSortDirection | null>(null);

  /**
   * Title sort is desktop-only. While a task checklist is expanded or after task-level checkbox
   * changes, keep status/due-date default order from `useTaskFilters` (no conflict with step sort).
   */
  const displayTasks = useMemo(() => {
    const base = effectiveFilteredTasks;
    const applyTitleSort = !isMobile && titleSort !== null && expandedTasks.size === 0;
    if (!applyTitleSort) return base;
    return sortTasksByTitle(base, titleSort);
  }, [effectiveFilteredTasks, titleSort, expandedTasks.size, isMobile]);

  const handleTitleSortToggle = useCallback(() => {
    if (isMobile) return;
    setTitleSort((prev) => {
      if (prev === null) return 'asc';
      if (prev === 'asc') return 'desc';
      return null;
    });
  }, [isMobile]);

  useEffect(() => {
    if (highlightedTask && taskRefs.current[highlightedTask] && scrollContainerRef.current) {
      const taskElement = taskRefs.current[highlightedTask];
      const scrollContainer = scrollContainerRef.current;
      if (taskElement) {
        setTimeout(() => {
          const taskRect = taskElement.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const isVisible =
            taskRect.top >= containerRect.top && taskRect.bottom <= containerRect.bottom;
          if (!isVisible) {
            const scrollTop =
              scrollContainer.scrollTop +
              (taskRect.top - containerRect.top) -
              containerRect.height / 2 +
              taskRect.height / 2;
            scrollContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
          }
        }, 150);
      }
    }
  }, [highlightedTask]);

  const toggleTaskExpansion = (taskId: string) => {
    const isOpen = expandedTasks.has(taskId);
    if (isOpen) {
      setExpandedTasks(new Set());
    } else {
      setExpandedTasks(new Set([taskId]));
      const ids = displayTasks.map((t) => t.id);
      const idx = ids.indexOf(taskId);
      const toFetch: string[] = [taskId];
      for (let i = 1; i <= 4 && idx + i < ids.length; i++) {
        const nextId = ids[idx + i];
        if (nextId && !blockerCountFetchedForRef.current.has(nextId)) toFetch.push(nextId);
      }
      fetchBlockerCountForTasks(toFetch);
    }
  };

  const handleStatusToggle = (task: Task) => {
    const visibleSteps = getVisibleStepsEffective(task);
    const progress = getEffectiveProgressAndCount(visibleSteps).progress;
    const checkboxRule = getTaskCheckboxRule({
      task,
      progress,
      visibleStepCount: visibleSteps.length,
    });

    if (!checkboxRule.taskHasSteps) {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      if (newStatus !== task.status) {
        setStatusToggleDialog({
          isOpen: true,
          taskId: task.id,
          taskTitle: task.title,
          nextStatus: newStatus,
        });
      }
      return;
    }

    // Tasks with steps are fully step-driven and cannot be toggled manually.
    if (checkboxRule.isStepProgressFull) {
      toast({
        title: t('dailyTask.cannotUncheckTask', 'Cannot Uncheck Task'),
        description: t(
          'dailyTask.cannotUncheckTaskDesc',
          'Cannot uncheck task with steps. Please manage steps individually.'
        ),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('dailyTask.cannotCompleteTask', 'Cannot Complete Task'),
      description: t('dailyTask.completeAllStepsFirst', 'Please complete all assigned steps first'),
      variant: 'destructive',
    });
  };

  const handleDateChange = async (taskId: string, date: Date) => {
    const updateData: Partial<Task> = { due_date: format(date, 'yyyy-MM-dd') };
    if (reminderPendingTaskId === taskId) {
      updateData.has_reminder = true;
      setReminderPendingTaskId(null);
    }
    try {
      await updateTask(taskId, updateData);
      setDatePickerOpen(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const handleClearDate = async (taskId: string) => {
    try {
      await updateTask(taskId, { due_date: null });
      setDatePickerOpen(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: Task['priority']) => {
    try {
      await updateTask(taskId, { priority: newPriority });
    } catch {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const handleDeleteClick = (task: Task) => {
    setDeleteDialog({ isOpen: true, taskId: task.id, taskTitle: task.title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.taskId) return;
    await deleteTask(deleteDialog.taskId);
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  };

  const handleCancelDelete = () => {
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  };

  const handleCancelStatusToggle = () => {
    setStatusToggleDialog({ isOpen: false, taskId: null, taskTitle: '', nextStatus: 'pending' });
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleDialog.taskId) return;
    const { taskId, taskTitle, nextStatus } = statusToggleDialog;
    setStatusToggleDialog({ isOpen: false, taskId: null, taskTitle: '', nextStatus: 'pending' });
    toast({
      title:
        nextStatus === 'completed'
          ? t('dailyTask.taskCompleted', 'Task Completed')
          : t('dailyTask.taskReopened', 'Task Reopened'),
      description:
        nextStatus === 'completed'
          ? t('dailyTask.taskCompletedDesc', '"{{title}}" has been marked as completed', { title: taskTitle })
          : t('dailyTask.taskReopenedDesc', '"{{title}}" has been reopened', { title: taskTitle }),
    });
    setTitleSort(null);
    try {
      await updateTask(taskId, { status: nextStatus });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('dailyTask.errors.updateTaskStatusFailed', 'Failed to update task status'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleReminder = async (task: Task) => {
    const currentValue = task.has_reminder ?? false;
    const newReminderValue = !currentValue;
    if (newReminderValue && !task.due_date) {
      setReminderPendingTaskId(task.id);
      setDatePickerOpen(task.id);
      return;
    }
    try {
      await updateTask(task.id, { has_reminder: newReminderValue });
    } catch {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId.startsWith('step-') && overId.startsWith('step-')) {
      const activeStepId = activeId.replace('step-', '');
      const overStepId = overId.replace('step-', '');
      const task = tasks.find(
        (t) =>
          t.steps.some((s) => s.id === activeStepId) && t.steps.some((s) => s.id === overStepId)
      );
      if (task) {
        const sortedSteps = [...task.steps].sort((a, b) => a.order - b.order);
        const activeIndex = sortedSteps.findIndex((s) => s.id === activeStepId);
        const overIndex = sortedSteps.findIndex((s) => s.id === overStepId);
        if (activeIndex !== -1 && overIndex !== -1) {
          const newSteps = [...sortedSteps];
          const [removed] = newSteps.splice(activeIndex, 1);
          newSteps.splice(overIndex, 0, removed);
          const stepIds = newSteps.map((step) => step.id);
          reorderTaskSteps(task.id, stepIds).catch(() => {
            toast({ title: 'Error', description: 'Failed to reorder steps', variant: 'destructive' });
          });
        }
      }
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <TooltipProvider>
        <div className="h-full flex flex-col min-h-0">
          <div
            ref={scrollContainerRef}
            className={`flex-1 min-h-0 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-auto ${hideScrollbarClassName}`}
          >
            <table className="w-full caption-bottom text-sm task-list-table">
              <TaskListTableHeader
                enableTitleSort={!isMobile}
                titleSort={titleSort}
                onTitleSortToggle={handleTitleSortToggle}
                titleSortAriaLabel={t('dailyTask.sort.taskTitle', 'Sort by task title')}
              />
              <TableBody>
                {displayTasks.length === 0 ? (
                  <TableRow className="w-full">
                    <TableCell
                      colSpan={14}
                      className="text-center py-8 text-gray-500 w-full"
                      style={{ width: '100%' }}
                    >
                      <div className="flex flex-col items-center w-full gap-2">
                        <CheckSquare className="w-8 h-8 text-gray-300" />
                        <p>No tasks found</p>
                        {tasks.length > 0 ? (
                          <>
                            <p className="text-sm text-gray-400">
                              {filters.planDateRange === 'custom_month_plan' && filters.customPlanMonth
                                ? t('dailyTask.emptyState.noTasksForSelectedMonth', 'No tasks for the selected month.')
                                : t('dailyTask.emptyState.noTasksMatchFilters', 'No tasks match your current filters. Change the Plan filter (calendar icon) to "All Dates & Plans", or click below.')}
                            </p>
                            <button
                              type="button"
                              onClick={async () => {
                                setFilters((prev) => ({ ...prev, myTask: 'all', pic: '', search: '', status: '', priority: '', dateRange: undefined, planDateRange: undefined, objectiveLink: 'all' }));
                                try {
                                  await refetchTasks();
                                } catch {
                                  // Filters already cleared; list will update from current cache
                                }
                              }}
                              className="text-sm text-primary hover:underline"
                            >
                              {t('dailyTask.emptyState.showAllTasks', 'Show all tasks')}
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400">Create your first task to get started</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayTasks.map((task) => (
                    <TaskListRow
                      key={task.id}
                      task={task}
                      objectiveTitle={task.objective_id ? (objectiveIdToTitle[task.objective_id] ?? null) : null}
                      isExpanded={expandedTasks.has(task.id)}
                      isHighlighted={highlightedTask === task.id}
                      isHighlightedFromPendingApproval={highlightFromPendingApproval && highlightedTask === task.id}
                      department={departmentMap[task.id]}
                      blockerCount={blockerCountByTask[task.id] ?? 0}
                      filters={filters}
                      getVisibleSteps={getVisibleStepsEffective}
                      rowRef={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      datePickerOpen={datePickerOpen}
                      reminderPendingTaskId={reminderPendingTaskId}
                      onToggleExpansion={toggleTaskExpansion}
                      onStatusToggle={handleStatusToggle}
                      onOpenBlockers={openTaskBlockers}
                      onDateChange={handleDateChange}
                      onClearDate={handleClearDate}
                      onPriorityChange={handlePriorityChange}
                      onDeleteClick={handleDeleteClick}
                      onToggleReminder={handleToggleReminder}
                      setDatePickerOpen={setDatePickerOpen}
                      setReminderPendingTaskId={setReminderPendingTaskId}
                      setHistoryDialog={setHistoryDialog}
                      setDeadlineDialog={setDeadlineDialog}
                      setEditingTask={setEditingTask}
                      setAddStepDialog={setAddStepDialog}
                      setAddTemplateDialog={setAddTemplateDialog}
                      userId={user?.id}
                    />
                  ))
                )}
              </TableBody>
            </table>
          </div>

          <TaskListDialogs
            tasks={tasks}
            deadlineDialog={deadlineDialog}
            setDeadlineDialog={setDeadlineDialog}
            historyDialog={historyDialog}
            setHistoryDialog={setHistoryDialog}
            editingTask={editingTask}
            setEditingTask={setEditingTask}
            addStepDialog={addStepDialog}
            setAddStepDialog={setAddStepDialog}
            addTemplateDialog={addTemplateDialog}
            setAddTemplateDialog={setAddTemplateDialog}
            deleteDialog={deleteDialog}
            handleCancelDelete={handleCancelDelete}
            handleConfirmDelete={handleConfirmDelete}
            statusToggleDialog={statusToggleDialog}
            handleCancelStatusToggle={handleCancelStatusToggle}
            handleConfirmStatusToggle={handleConfirmStatusToggle}
            blockerModalOpen={blockerModalOpen}
            setBlockerModalOpen={setBlockerModalOpen}
            blockerModalItems={blockerModalItems}
            requestDeadlineExtension={requestDeadlineExtension}
          />
        </div>
      </TooltipProvider>
    </DndContext>
  );
};

