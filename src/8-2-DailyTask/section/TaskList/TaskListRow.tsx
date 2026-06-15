import React from 'react';
import {
  CheckSquare,
  Square,
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  UserPlus,
  History,
  Clock3,
  Paperclip,
  Target,
  Bell,
  Building2,
  Edit,
  Trash2,
  Plus,
  Flag,
  Layers,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { TableCell, TableRow } from '@/shared/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { CustomDatePicker } from '@/shared/calendar';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isSameMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { TaskStep } from '../TaskStep';
import { plainTextPreview } from '@/8-2-DailyTask/lib/taskStepDescription';
import {
  getStatusBadge,
  getPriorityBadge,
  formatDate,
  isOverdue,
  isTaskCreator,
  calculateAssignedStepsProgress,
} from './taskListHelpers';
import type { Task } from '../../types';
import { useDailyTask } from '../../context/DailyTaskContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Badge } from '@/shared/components/ui/badge';
import { getTaskCheckboxRule } from '../../utils/taskCheckboxRules';

export interface TaskListRowProps {
  task: Task;
  /** Resolved Individual Objective title for display; null when unlinked. */
  objectiveTitle: string | null;
  isExpanded: boolean;
  isHighlighted: boolean;
  /** When true, use amber highlight (from pending approval click). */
  isHighlightedFromPendingApproval?: boolean;
  department: { id: string; name: string } | undefined;
  blockerCount: number;
  filters: { pic?: string } | null;
  getVisibleSteps: (task: Task) => Task['steps'];
  rowRef: (el: HTMLTableRowElement | null) => void;
  datePickerOpen: string | null;
  reminderPendingTaskId: string | null;
  onToggleExpansion: (taskId: string) => void;
  onStatusToggle: (task: Task) => void;
  onOpenBlockers: (task: Task) => void;
  onDateChange: (taskId: string, date: Date) => void;
  onClearDate: (taskId: string) => void;
  onPriorityChange: (taskId: string, priority: Task['priority']) => void;
  onDeleteClick: (task: Task) => void;
  onToggleReminder: (task: Task) => void;
  setDatePickerOpen: (v: string | null) => void;
  setReminderPendingTaskId: (v: string | null) => void;
  setHistoryDialog: (v: { isOpen: boolean; taskId: string | null }) => void;
  setDeadlineDialog: (v: { isOpen: boolean; taskId: string | null }) => void;
  setEditingTask: (v: string | null) => void;
  setAddStepDialog: (v: { isOpen: boolean; taskId: string | null; taskTitle: string }) => void;
  setAddTemplateDialog: (v: { isOpen: boolean; taskId: string | null; taskTitle: string }) => void;
  userId: string | undefined;
}

export function TaskListRow({
  task,
  objectiveTitle,
  isExpanded,
  isHighlighted,
  isHighlightedFromPendingApproval = false,
  department,
  blockerCount,
  filters,
  getVisibleSteps,
  rowRef,
  datePickerOpen,
  reminderPendingTaskId,
  onToggleExpansion,
  onStatusToggle,
  onOpenBlockers,
  onDateChange,
  onClearDate,
  onPriorityChange,
  onDeleteClick,
  onToggleReminder,
  setDatePickerOpen,
  setReminderPendingTaskId,
  setHistoryDialog,
  setDeadlineDialog,
  setEditingTask,
  setAddStepDialog,
  setAddTemplateDialog,
  userId,
}: TaskListRowProps) {
  const { t } = useAppTranslation();
  const { rejectedReasonsByTaskId } = useDailyTask();
  const taskRejectReason = rejectedReasonsByTaskId[task.id];
  const visibleSteps = getVisibleSteps(task);
  const progress = calculateAssignedStepsProgress(task, visibleSteps);
  const checkboxRule = getTaskCheckboxRule({
    task,
    progress,
    visibleStepCount: visibleSteps.length,
  });
  const creatorCanEdit = isTaskCreator(task, userId);
  const isOverdueTask = isOverdue(task.due_date, task.status);
  const displayStatus =
    task.status === 'cancelled'
      ? 'cancelled'
      : progress >= 100
        ? 'completed'
        : progress > 0
          ? 'in_progress'
          : 'pending';

  return (
    <React.Fragment>
      <TableRow
        ref={rowRef}
        className={`w-full hover:bg-gray-50 transition-all duration-300 ${
          isHighlightedFromPendingApproval
            ? 'bg-amber-50 border-l-4 border-l-amber-500 shadow-md'
            : isHighlighted
              ? 'border-l-4 border-l-primary bg-primary/5 shadow-md'
              : ''
        }`}
      >
        <TableCell className="px-2 py-3 text-center" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleExpansion(task.id)}
            className="h-7 w-7 p-0 hover:bg-gray-200"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </TableCell>

        <TableCell className="px-2 py-3 text-center" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStatusToggle(task);
            }}
            disabled={checkboxRule.isDisabled}
            className={`flex-shrink-0 transition-colors ${
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
            {checkboxRule.isChecked ? (
              <CheckSquare className="w-5 h-5 text-green-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        </TableCell>

        <TableCell className="px-2 py-3" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`text-sm font-medium cursor-pointer hover:text-primary truncate flex flex-wrap items-center gap-2 ${
                  checkboxRule.isChecked ? 'line-through text-gray-500' : 'text-gray-900'
                }`}
                onClick={() => onToggleExpansion(task.id)}
              >
                {isHighlightedFromPendingApproval && <Target className="w-4 h-4 text-amber-600 animate-pulse" />}
                {isHighlighted && !isHighlightedFromPendingApproval && <Target className="w-4 h-4 text-primary animate-pulse" />}
                {task.title}
                {taskRejectReason && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                    {t('dailyTask.approval.revisionBadge', 'Revision')}
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-md flex max-h-[min(280px,45vh)] flex-col overflow-hidden p-0 bg-gray-900 text-white shadow-lg border-gray-700"
            >
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-gray-300 mt-2 border-t border-gray-700 pt-2 whitespace-pre-wrap break-words">
                    {plainTextPreview(task.description, 300)}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          {taskRejectReason && (
            <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
              <p className="font-medium text-amber-800">
                {t('dailyTask.approval.reasonForRejectionLabel', 'Reason for Rejection')}
              </p>
              <p className="text-gray-700 mt-0.5">{taskRejectReason}</p>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {task.steps.length > 0 && (
              <div className="flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                {task.steps.filter((s) => s.is_completed).length}/{task.steps.length} steps
              </div>
            )}
            {task.files.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {task.files.length} files
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="px-2 py-3 text-left overflow-hidden" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
          {task.objective_id ? (
            <Badge variant="secondary" className="text-[10px] font-normal border border-primary/20 bg-primary/5 text-primary truncate max-w-full inline-block" title={objectiveTitle || undefined}>
              {t('dailyTask.objective.linkedTo', 'Linked to')}: {objectiveTitle || '…'}
            </Badge>
          ) : (
            <span className="text-[10px] text-gray-400 italic">
              {t('dailyTask.objective.notLinked', 'Not linked')}
            </span>
          )}
        </TableCell>

        <TableCell className="px-2 py-3 text-left overflow-hidden" style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}>
          <div className="flex items-center gap-2 min-w-0">
            {department ? (
              <>
                <Building2 className="w-4 h-4 shrink-0 text-primary" />
                <span className="text-sm text-gray-900 font-medium truncate block min-w-0" title={department.name}>
                  {department.name}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400 italic">No Department</span>
            )}
          </div>
        </TableCell>

        <TableCell className="px-2 py-3 text-left overflow-hidden" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
          <div className="flex items-start min-w-0">
            {task.assigned_to_name ? (
              <div className="flex gap-2 min-w-0 overflow-hidden">
                <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm text-gray-900 font-medium truncate block"
                    title={task.assigned_to_name}
                  >
                    {task.assigned_to_name}
                  </span>
                  {task.assigned_by_name ? (
                    <div
                      className="flex items-center gap-1 min-w-0 mt-0.5"
                      title={t('dailyTask.picAssignedByTooltip', 'Assigned by {{name}}', {
                        name: task.assigned_by_name,
                      })}
                    >
                      <UserPlus
                        className="w-3 h-3 flex-shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <span className="text-xs text-gray-500 truncate">
                        {task.assigned_by_name}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">
                {t('dailyTask.picUnassigned', 'Unassigned')}
              </span>
            )}
          </div>
        </TableCell>

        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
          {task.plan_date ? (
            (() => {
              const planDateObj = new Date(task.plan_date);
              const dueDateObj = task.due_date ? new Date(task.due_date) : null;
              const isDifferent = dueDateObj && !isSameMonth(planDateObj, dueDateObj);
              return (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {format(planDateObj, 'MMM yyyy', { locale: idLocale })}
                  </span>
                  {isDifferent && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-700 text-xs font-bold"
                      title="Plan date berbeda dari Due date"
                    >
                      !
                    </span>
                  )}
                </div>
              );
            })()
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </TableCell>

        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
          <Popover
            open={datePickerOpen === task.id}
            onOpenChange={(open) => {
              setDatePickerOpen(open ? task.id : null);
              if (!open && reminderPendingTaskId === task.id) setReminderPendingTaskId(null);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={`h-auto p-1 hover:bg-gray-100 rounded-md transition-colors ${
                  isOverdueTask ? 'text-red-600 font-medium hover:bg-red-50' : 'text-gray-600'
                }`}
              >
                {task.due_date ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="text-sm">{formatDate(task.due_date)}</span>
                    </div>
                    {isOverdueTask && <span className="text-xs text-red-500">Overdue</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span className="text-sm">Set date</span>
                  </div>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border border-gray-200 rounded-lg shadow-lg" align="center">
              <div className="p-2">
                {reminderPendingTaskId === task.id && !task.due_date && (
                  <div className="mb-2 px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    Set due date untuk mengaktifkan pengingat
                  </div>
                )}
                <CustomDatePicker
                  selected={task.due_date ? new Date(task.due_date) : undefined}
                  onSelect={(date) => date && onDateChange(task.id, date)}
                  className="border-0 shadow-none"
                />
                {task.due_date && (
                  <div className="flex justify-center pt-2 border-t mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onClearDate(task.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Clear Date
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </TableCell>

        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
          {task.finish_date ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-green-600" />
                <span className="text-sm text-green-600 font-medium">{formatDate(task.finish_date)}</span>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </TableCell>

        <TableCell className="px-2 pr-2 py-3 text-center" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
          {blockerCount > 0 ? (
            <button onClick={() => onOpenBlockers(task)} className="text-xs font-medium text-purple-700 hover:underline">
              Found {blockerCount} Blocker{blockerCount > 1 ? 's' : ''}
            </button>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </TableCell>

        <TableCell className="px-2 pr-8 py-3 text-center" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                disabled={!creatorCanEdit}
                className={`priority-dropdown-trigger h-auto p-1 rounded-md transition-colors ${
                  creatorCanEdit ? 'hover:bg-gray-50 hover:text-inherit cursor-pointer' : 'opacity-60 cursor-not-allowed'
                }`}
                title={creatorCanEdit ? 'Change priority' : '🔒 Only task creator can change priority'}
              >
                {getPriorityBadge(task.priority)}
              </Button>
            </DropdownMenuTrigger>
            {creatorCanEdit && (
              <DropdownMenuContent align="center" className="w-32">
                <DropdownMenuItem onClick={() => onPriorityChange(task.id, 'low')} className="flex items-center gap-2">
                  <Flag className="w-3 h-3 text-green-600" />
                  <span className="text-green-700">Low</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(task.id, 'medium')} className="flex items-center gap-2">
                  <Flag className="h-3 w-3 text-primary" />
                  <span className="text-primary">Medium</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(task.id, 'high')} className="flex items-center gap-2">
                  <Flag className="w-3 h-3 text-orange-600" />
                  <span className="text-orange-700">High</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(task.id, 'urgent')} className="flex items-center gap-2">
                  <Flag className="w-3 h-3 text-red-600" />
                  <span className="text-red-700">Urgent</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onPriorityChange(task.id, 'needs_to_be_presented')}
                  className="flex items-center gap-2"
                >
                  <Flag className="w-3 h-3 text-purple-600" />
                  <span className="text-purple-700">Presentation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </TableCell>

        <TableCell className="px-2 py-3 text-center" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
          {getStatusBadge(displayStatus)}
        </TableCell>

        <TableCell className="px-2 py-3" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500">
              {visibleSteps.length > 0 ? `${progress}%` : task.status === 'completed' ? '100%' : 'No steps'}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  progress === 100 ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </TableCell>

        <TableCell className="px-2 py-3 text-center" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleReminder(task)}
              className={`h-7 w-7 p-0 ${
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
              <Bell className={`w-3 h-3 ${task.has_reminder ?? false ? 'fill-current' : ''}`} />
            </Button>
            {task.deadline_history && task.deadline_history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryDialog({ isOpen: true, taskId: task.id })}
                className="h-7 w-7 p-0 hover:bg-gray-50 hover:text-gray-600"
                title="View deadline history"
              >
                <History className="w-3 h-3" />
              </Button>
            )}
            {task.status !== 'completed' && task.due_date && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeadlineDialog({ isOpen: true, taskId: task.id })}
                className="h-7 w-7 p-0 hover:bg-orange-50 hover:text-orange-600"
                title="Request deadline extension"
              >
                <Clock3 className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => creatorCanEdit && setEditingTask(task.id)}
              disabled={!creatorCanEdit}
              className={`h-7 w-7 p-0 ${
                creatorCanEdit ? 'cursor-pointer hover:bg-primary/10 hover:text-primary' : 'opacity-40 cursor-not-allowed'
              }`}
              title={creatorCanEdit ? 'Edit task' : '🔒 Only task creator can edit'}
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => creatorCanEdit && onDeleteClick(task)}
              disabled={!creatorCanEdit}
              className={`h-7 w-7 p-0 ${
                creatorCanEdit ? 'hover:bg-red-50 hover:text-red-600 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              }`}
              title={creatorCanEdit ? 'Delete task' : '🔒 Only task creator can delete'}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="w-full">
          <TableCell
            colSpan={14}
            className={`w-full px-4 py-4 border-t transition-all duration-300 ${
              isHighlightedFromPendingApproval
                ? 'bg-amber-50 border-l-4 border-l-amber-500 border-amber-200'
                : isHighlighted
                  ? 'border-l-4 border-l-primary border-primary/25 bg-primary/10'
                  : 'border-primary/20 bg-primary/5'
            }`}
            style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
          >
            {task.description && (
              <div className="mb-4 w-full min-w-0">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Description</h4>
                <div className="max-h-48 overflow-y-auto seamless-scroll">
                  <p
                    className="text-sm text-gray-600 break-words whitespace-pre-wrap overflow-wrap-anywhere"
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    {task.description}
                  </p>
                </div>
              </div>
            )}
            <div className="w-full space-y-4" style={{ width: '100%' }}>
              <div className="w-full">
                <div className="flex items-center justify-between mb-3 w-full">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    {t('dailyTask.workflow') ?? 'Workflow'} (
                    {`${visibleSteps.filter((s) => s.is_completed).length}/${visibleSteps.length}`})
                  </h4>
                  <div className="flex items-center gap-1">
                    {creatorCanEdit && !task.daily_template_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddTemplateDialog({ isOpen: true, taskId: task.id, taskTitle: task.title })}
                        className="cursor-pointer text-primary hover:bg-primary/10 hover:text-primary/90"
                        title={t('dailyTask.template.addTemplate') ?? 'Add template to this task'}
                      >
                        <Layers className="w-4 h-4 mr-1" />
                        {t('dailyTask.template.addTemplate') ?? 'Add Template'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (creatorCanEdit) setAddStepDialog({ isOpen: true, taskId: task.id, taskTitle: task.title });
                      }}
                      disabled={!creatorCanEdit}
                      className={`${
                        creatorCanEdit
                          ? 'cursor-pointer text-primary hover:bg-primary/10 hover:text-primary/90'
                          : 'cursor-not-allowed text-gray-400 opacity-50'
                      }`}
                      title={creatorCanEdit ? 'Add a new step to this task' : '🔒 Only task creator can add steps'}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Step
                    </Button>
                  </div>
                </div>
                <SortableContext
                  items={task.steps.map((step) => `step-${step.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[50px] w-full">
                    {visibleSteps.length === 0 ? (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                        <CheckSquare className="mx-auto mb-2 h-8 w-8 text-primary/70" />
                        <p className="mb-1 text-sm font-medium text-foreground">No steps yet</p>
                        <p className="text-xs text-muted-foreground">
                          {filters?.pic ? 'No steps assigned to selected PIC' : 'Steps will appear here once created or assigned to you'}
                        </p>
                      </div>
                    ) : (
                      visibleSteps
                        .slice()
                        .sort((a, b) => {
                          // Completed steps go to the very bottom (after all incomplete)
                          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
                          // If all steps have due date: sort by due date ascending, then by step_priority (same date = urutan by prioritas)
                          const allHaveDueDate = visibleSteps.every((s) => s.assigned_due_date);
                          if (allHaveDueDate) {
                            const timeA = a.assigned_due_date ? new Date(a.assigned_due_date).getTime() : Number.MAX_SAFE_INTEGER;
                            const timeB = b.assigned_due_date ? new Date(b.assigned_due_date).getTime() : Number.MAX_SAFE_INTEGER;
                            if (timeA !== timeB) return timeA - timeB;
                            // Same date: sort by step_priority (lower = top), then by order
                            const priA = a.step_priority ?? 999;
                            const priB = b.step_priority ?? 999;
                            if (priA !== priB) return priA - priB;
                            return (a.order ?? 0) - (b.order ?? 0);
                          }
                          // Else: sort by step_priority then order
                          const priA = a.step_priority ?? 999;
                          const priB = b.step_priority ?? 999;
                          if (priA !== priB) return priA - priB;
                          return (a.order ?? 0) - (b.order ?? 0);
                        })
                        .map((step, index) => (
                          <TaskStep
                            key={step.id}
                            step={step}
                            index={index}
                            taskCreatedBy={task.created_by}
                            taskAssignedTo={task.assigned_to}
                            taskTitle={task.title}
                            autoReorder={true}
                          />
                        ))
                    )}
                  </div>
                </SortableContext>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}
