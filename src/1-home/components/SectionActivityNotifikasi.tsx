import React, { lazy, Suspense, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useEmployeeAssignments } from './hooks/useEmployeeAssignments';
import { JobDescTimeframe, DateRangeValue, JobDescAssignment } from '@/8-2-DailyTask/section/JobDescTracker/types';
import { useDailyTaskOptional } from '@/8-2-DailyTask/context/DailyTaskContext';
import { differenceInCalendarDays, startOfDay, format, formatDistanceToNowStrict } from 'date-fns';
const ModalViewSubSteps = lazy(() =>
  import('@/8-2-DailyTask/section/ModalViewSubSteps').then((m) => ({
    default: m.ModalViewSubSteps,
  })),
);
import { supabase } from '@/shared/lib/supabaseClient';
import { id as indonesianLocale } from 'date-fns/locale';
import { cn } from '@/shared/lib/utils';
import { logger } from '@/shared/lib/logger';
import { Skeleton } from '@/shared/components/ui/skeleton';

const timeframeOptions: { value: JobDescTimeframe; translationKey: string }[] = [
  { value: "daily", translationKey: "dailyTask.jobDesc.filters.daily" },
  { value: "weekly", translationKey: "dailyTask.jobDesc.filters.weekly" },
  { value: "monthly", translationKey: "dailyTask.jobDesc.filters.monthly" },
  { value: "custom", translationKey: "dailyTask.jobDesc.filters.custom" },
];

const assignmentTypeKey: Record<JobDescAssignment["type"], string> = {
  task: "dailyTask.jobDesc.assignment.type.task",
  step: "dailyTask.jobDesc.assignment.type.step",
  subStep: "dailyTask.jobDesc.assignment.type.subStep",
};

const formatDate = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch (_error) {
    return fallback;
  }
};

interface SectionActivityNotifikasiProps {
  /** When true, used on Home without DailyTaskProvider; only navigates to /tools/daily-task with params. */
  standalone?: boolean;
}

export const SectionActivityNotifikasi = ({ standalone }: SectionActivityNotifikasiProps = {}) => {
  const { t, language } = useAppTranslation();
  const locale = language === "id" ? indonesianLocale : undefined;
  const navigate = useNavigate();
  const dailyTask = useDailyTaskOptional();
  const [activeTab, setActiveTab] = useState<'activities' | 'notifications'>('activities');
  const [timeframe, setTimeframe] = useState<JobDescTimeframe>("weekly");
  const [customRange, setCustomRange] = useState<DateRangeValue>({
    start: null,
    end: null,
  });
  const [selectedType, setSelectedType] = useState<'all' | 'task' | 'step' | 'subStep'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { isLoading: employeeLoading } = useCurrentEmployee();
  const { data: summary, isLoading, error } = useEmployeeAssignments({
    timeframe,
    customRange,
    includeOverdue: true,
  });

  const activitySectionLoading = orgBootstrapPending || employeeLoading || isLoading;

  const activityError =
    error instanceof Error ? error : error ? new Error(String(error)) : null;
  useReportHomeSectionStatus('activity', activitySectionLoading, activityError);
    
  const useNavigateOnly = standalone || !dailyTask;

  // State untuk modal sub-step
  const [subStepModal, setSubStepModal] = useState<{
    open: boolean;
    parentStepId: string;
    parentStepTitle: string;
  }>({
    open: false,
    parentStepId: '',
    parentStepTitle: '',
  });

  // Cache untuk performance optimization
  const [stepIdCache, setStepIdCache] = useState<Map<string, string>>(new Map());
  const [parentStepIdCache, setParentStepIdCache] = useState<Map<string, string>>(new Map());

  // Helper function untuk mendapatkan stepId dari assignmentId (dengan cache)
  const getStepId = useCallback(async (assignmentId: string): Promise<string | null> => {
    if (stepIdCache.has(assignmentId)) {
      return stepIdCache.get(assignmentId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('task_steps_assigned')
        .select('task_step_id')
        .eq('id', assignmentId)
        .single();

      if (error || !data) return null;

      const stepId = data.task_step_id;
      setStepIdCache(prev => new Map(prev).set(assignmentId, stepId));
      return stepId;
    } catch (error) {
      logger.error('Error fetching stepId:', error);
      return null;
    }
  }, [stepIdCache]);

  // Helper function untuk mendapatkan parentStepId dari assignmentId (dengan cache)
  const getParentStepId = useCallback(async (assignmentId: string): Promise<string | null> => {
    if (parentStepIdCache.has(assignmentId)) {
      return parentStepIdCache.get(assignmentId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('task_steps_to_steps_assigned')
        .select(`
          task_steps_to_steps_id,
          task_steps_to_steps!inner(parent_step_id)
        `)
        .eq('id', assignmentId)
        .single();

      if (error || !data) return null;

      const parentStepId = (data as any).task_steps_to_steps?.parent_step_id;
      if (parentStepId) {
        setParentStepIdCache(prev => new Map(prev).set(assignmentId, parentStepId));
        return parentStepId;
      }
      return null;
    } catch (error) {
      logger.error('Error fetching parentStepId:', error);
      return null;
    }
  }, [parentStepIdCache]);

  // Handle click pada task title - sama persis dengan JobDescEmployeeCard
  const handleTaskTitleClick = useCallback(async (assignment: JobDescAssignment) => {
    const params = new URLSearchParams();
    params.set('taskId', assignment.taskId);

    if (assignment.type === 'task') {
      const searchTitle = assignment.title || assignment.taskTitle;
      if (searchTitle) params.set('search', searchTitle);
      params.set('action', 'navigate');
      if (!useNavigateOnly && dailyTask) {
        dailyTask.setFilters(prev => ({ ...prev, search: searchTitle }));
      }
      navigate(`/tools/daily-task?${params.toString()}`);
      return;
    }

    if (assignment.type === 'step') {
      if (assignment.stepTitle) params.set('search', assignment.stepTitle);
      const stepId = await getStepId(assignment.assignmentId);
      if (stepId) {
        params.set('stepId', stepId);
        params.set('action', 'scroll');
      } else {
        params.set('action', 'navigate');
      }
      if (!useNavigateOnly && dailyTask) {
        dailyTask.setFilters(prev => ({ ...prev, search: assignment.stepTitle }));
        dailyTask.setExpandedTasks(prev => new Set([...prev, assignment.taskId]));
      }
      navigate(`/tools/daily-task?${params.toString()}`);
      return;
    }

    if (assignment.type === 'subStep') {
      if (assignment.stepTitle) params.set('search', assignment.stepTitle);
      const parentStepId = await getParentStepId(assignment.assignmentId);
      if (parentStepId) {
        params.set('stepId', parentStepId);
        params.set('action', 'scroll');
        params.set('subStep', 'true');
      } else {
        params.set('action', 'navigate');
      }
      if (!useNavigateOnly && dailyTask) {
        dailyTask.setFilters(prev => ({ ...prev, search: assignment.stepTitle }));
        dailyTask.setExpandedTasks(prev => new Set([...prev, assignment.taskId]));
      }
      navigate(`/tools/daily-task?${params.toString()}`);
    }
  }, [navigate, useNavigateOnly, dailyTask, getStepId, getParentStepId]);

  // Filter completed assignments (same logic as JobDescEmployeeCard)
  const completedAssignments = useMemo(
    () => summary.assignments.filter(assignment => assignment.completedInRange),
    [summary.assignments],
  );

  // Filter by type
  const filteredActiveAssignments = useMemo(() => {
    if (!summary.activeAssignments) return [];
    if (selectedType === 'all') return summary.activeAssignments;
    return summary.activeAssignments.filter(assignment => assignment.type === selectedType);
  }, [summary.activeAssignments, selectedType]);

  const filteredCompletedAssignments = useMemo(() => {
    if (selectedType === 'all') return completedAssignments;
    return completedAssignments.filter(assignment => assignment.type === selectedType);
  }, [completedAssignments, selectedType]);

  // Same logic as JobDescEmployeeCard
  const assignmentsToShow = filteredActiveAssignments.length
    ? filteredActiveAssignments
    : summary.assignments.slice(0, 3);

  const dueStatusMeta = useMemo(
    () => ({
      overdue: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.overdue", "Terlambat"),
        className: "border border-warning-muted bg-warning-muted text-warning-foreground",
      },
      dueSoon: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.dueSoon", "Jelang jatuh tempo"),
        className: "border border-primary/20 bg-accent text-accent-foreground",
      },
      onTrack: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.onTrack", "On track"),
        className: "border border-primary/20 bg-success-muted text-success-foreground",
      },
      noDue: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.noDue", "Tanpa due date"),
        className: "bg-muted text-muted-foreground border-border",
      },
    }),
    [t],
  );

  const typeFilters = [
    { id: 'all', label: t('activity.filter.all', 'All'), count: filteredActiveAssignments.length + filteredCompletedAssignments.length },
    { id: 'task', label: t('dailyTask.jobDesc.assignment.type.task', 'Task'), count: filteredActiveAssignments.filter(t => t.type === 'task').length + filteredCompletedAssignments.filter(t => t.type === 'task').length },
    { id: 'step', label: t('dailyTask.jobDesc.assignment.type.step', 'Step'), count: filteredActiveAssignments.filter(t => t.type === 'step').length + filteredCompletedAssignments.filter(t => t.type === 'step').length },
    { id: 'subStep', label: t('dailyTask.jobDesc.assignment.type.subStep', 'Sub-step'), count: filteredActiveAssignments.filter(t => t.type === 'subStep').length + filteredCompletedAssignments.filter(t => t.type === 'subStep').length },
  ];

  if (activitySectionLoading) {
    return (
      <Card className="flex h-full min-h-[320px] flex-col overflow-hidden" aria-hidden>
        <div className="flex flex-shrink-0 border-b border-border">
          <Skeleton className="m-2 h-9 flex-1 rounded-md" />
          <Skeleton className="m-2 h-9 flex-1 rounded-md" />
        </div>
        <CardHeader className="flex-shrink-0 space-y-2 pb-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex flex-shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'activities'
              ? 'border-b-2 border-primary bg-accent text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {t('activity.tab.activities', 'Activities')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'notifications'
              ? 'border-b-2 border-primary bg-accent text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {t('activity.tab.notifications', 'Notifications')}
        </button>
        </div>
        
      <CardHeader className="pb-2 flex-shrink-0">
        {/* Timeframe Filter - Only show for Activities tab */}
        {activeTab === 'activities' && (
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t("dailyTask.jobDesc.filters.timeframe", "Timeframe")}
              </p>
              <div className="flex flex-wrap gap-2">
                {timeframeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeframe(option.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full border transition-colors",
                      timeframe === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30",
                    )}
                  >
                    {t(option.translationKey, option.value)}
                  </button>
            ))}
          </div>
        </div>

            {timeframe === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("dailyTask.jobDesc.filters.customStart", "Start date")}
                  </Label>
                  <Input
                    type="date"
                    value={customRange.start ? customRange.start.toISOString().slice(0, 10) : ""}
                    onChange={(event) =>
                      setCustomRange({
                        ...customRange,
                        start: event.target.value ? new Date(event.target.value) : null,
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("dailyTask.jobDesc.filters.customEnd", "End date")}
                  </Label>
                  <Input
                    type="date"
                    value={customRange.end ? customRange.end.toISOString().slice(0, 10) : ""}
                    onChange={(event) =>
                      setCustomRange({
                        ...customRange,
                        end: event.target.value ? new Date(event.target.value) : null,
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-x-hidden px-4">
          {activeTab === 'activities' ? (
            <>
          {error ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-red-500 leading-relaxed">
                    {t('activity.error', 'Error loading activities')}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {/* Active Assignments */}
                  {assignmentsToShow.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("dailyTask.jobDesc.emptyState", "Belum ada tugas aktif pada rentang waktu ini")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignmentsToShow.map((assignment) => {
                        const typeLabel = t(
                          assignmentTypeKey[assignment.type],
                          assignment.type,
                        );
                        const pendingLabel = assignment.assignedAt
                          ? formatDistanceToNowStrict(new Date(assignment.assignedAt), {
                              locale,
                            })
                          : t("dailyTask.jobDesc.assignment.pendingUnknown", "Tidak diketahui");
                        const taskTitle =
                          assignment.type === "task" ? assignment.title : assignment.taskTitle;
                        const extraLabel =
                          assignment.type === "task"
                            ? assignment.priority ?? ""
                            : assignment.type === "step"
                              ? assignment.stepTitle
                              : assignment.subStepTitle;

                        const statusLabel =
                          assignment.type === "task"
                            ? (assignment.status ?? "").toLowerCase()
                            : assignment.type === "step"
                              ? assignment.isCompleted
                                ? "completed"
                                : "pending"
                              : assignment.isCompleted
                                ? "completed"
                                : "pending";

                        const statusColor =
                          statusLabel === "completed"
                            ? "border-primary/20 bg-success-muted text-success-foreground"
                            : "border-primary/20 bg-accent text-accent-foreground";

                        return (
                          <div
                            key={`${assignment.assignmentId}-${assignment.type}`}
                            className="cursor-pointer rounded-md border border-border p-2 text-xs transition-colors hover:bg-muted"
                            onClick={() => handleTaskTitleClick(assignment)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="line-clamp-1 font-semibold text-foreground">
                                  {taskTitle}
                                </p>
                                {extraLabel && (
                                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                    {extraLabel}
                                  </p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                  {assignment.dueDate && (
                                    <span>
                                      {t("dailyTask.jobDesc.assignment.due", "Due {{date}}", {
                                        date: formatDate(assignment.dueDate, "-"),
                                      })}
                                    </span>
                                  )}
                                  <span>
                                    {t("dailyTask.jobDesc.assignment.pendingFor", "Pending {{duration}}", {
                                      duration: pendingLabel,
                                    })}
                                  </span>
                                </div>
                              </div>
                              <Badge className={cn("text-[10px]", statusColor)}>
                                {statusLabel === "completed"
                                  ? t("dailyTask.jobDesc.assignment.completed", "Selesai")
                                  : t("dailyTask.jobDesc.assignment.pending", "Aktif")}
                          </Badge>
                        </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px]">
                                {typeLabel}
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full border text-[10px]",
                                  dueStatusMeta[assignment.dueStatus].className,
                                )}
                              >
                                {dueStatusMeta[assignment.dueStatus].label}
                              </span>
                              {assignment.dueStatus === "overdue" && assignment.dueDate && (
                                <span className="rounded-full border border-warning-muted bg-warning-muted px-2 py-0.5 text-[10px] text-warning-foreground">
                                  {t("dailyTask.jobDesc.assignment.completedLateDetail", "Terlambat {{days}} hari", {
                                    days: Math.max(
                                      differenceInCalendarDays(
                                        startOfDay(new Date()),
                                        startOfDay(new Date(assignment.dueDate)),
                                      ),
                                      1,
                                    ),
                                  })}
                                </span>
                              )}
                      </div>
                      </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Completed Assignments with Toggle */}
                  {filteredCompletedAssignments.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowCompleted((prev) => !prev)}
                        className="text-xs font-medium text-primary hover:text-primary/80"
                      >
                        {showCompleted
                          ? t("dailyTask.jobDesc.completed.hide", "Sembunyikan tugas selesai")
                          : t("dailyTask.jobDesc.completed.showAll", "Lihat {{count}} tugas selesai", {
                              count: filteredCompletedAssignments.length,
                            })}
                      </button>
                      {showCompleted && (
                        <div className="mt-2 space-y-2">
                          {filteredCompletedAssignments.map((assignment) => {
                            const typeLabel = t(assignmentTypeKey[assignment.type], assignment.type);
                            const completedTitle =
                              assignment.type === "task"
                                ? assignment.title
                                : assignment.type === "step"
                                  ? assignment.stepTitle
                                  : assignment.subStepTitle;
                            const completedDate = assignment.completedAt
                              ? startOfDay(new Date(assignment.completedAt))
                              : null;
                            const dueDateObj = assignment.dueDate
                              ? startOfDay(new Date(assignment.dueDate))
                              : null;
                            const lateDays =
                              completedDate && dueDateObj
                                ? differenceInCalendarDays(completedDate, dueDateObj)
                                : 0;
                            const isLateCompletion = Boolean(lateDays && lateDays > 0);
                            return (
                              <div
                                key={`${assignment.assignmentId}-${assignment.type}-completed`}
                                className="cursor-pointer rounded-md border border-primary/20 bg-success-muted p-2 text-xs transition-colors hover:bg-accent"
                                onClick={() => handleTaskTitleClick(assignment)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="line-clamp-1 font-semibold text-foreground">
                                      {completedTitle || assignment.taskTitle}
                                    </p>
                                    {assignment.type === "subStep" && assignment.stepTitle && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {t("dailyTask.jobDesc.assignment.parentStep", "Step: {{title}}", {
                                          title: assignment.stepTitle,
                                        })}
                                      </p>
                                    )}
                                    {assignment.type !== "task" && assignment.taskTitle && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {t("dailyTask.jobDesc.assignment.parentTask", "Task: {{title}}", {
                                          title: assignment.taskTitle,
                                        })}
                                      </p>
                                    )}
                                    {assignment.dueDate && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {t("dailyTask.jobDesc.assignment.due", "Due {{date}}", {
                                          date: formatDate(assignment.dueDate, "-"),
                                        })}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                      {assignment.completedAt
                                        ? t("dailyTask.jobDesc.assignment.completedOn", "Selesai {{date}}", {
                                            date: formatDate(assignment.completedAt, "-"),
                                          })
                                        : t("dailyTask.jobDesc.assignment.completed", "Selesai")}
                                    </p>
                                  </div>
                                  <Badge className="border-primary/20 bg-success-muted text-[10px] text-success-foreground">
                                    {t("dailyTask.jobDesc.assignment.completed", "Selesai")}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px]">
                                    {typeLabel}
                                  </span>
                                  {isLateCompletion && (
                                    <span className="rounded-full border border-warning-muted bg-warning-muted px-2 py-0.5 text-[10px] text-warning-foreground">
                                      {t(
                                        "dailyTask.jobDesc.assignment.completedLateDetail",
                                        "Terlambat {{days}} hari",
                                        { days: lateDays },
                                      )}
                                    </span>
                                  )}
                  </div>
                </div>
              );
            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-center h-32">
                <div className="text-sm leading-relaxed text-muted-foreground">{t('activity.noNotifications', 'No notifications')}</div>
              </div>
          </div>
          )}
        </div>
        
        {/* Type Filter Footer */}
        {activeTab === 'activities' && (
          <div className="flex-shrink-0 border-t border-border px-4 py-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-brand-accent" aria-hidden />
              <span className="text-[10px] font-medium uppercase tracking-wide text-brand-accent">
                {t('activity.filter.typeLabel', 'Tipe tugas')}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap gap-1 py-1">
                {typeFilters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setSelectedType(filter.id as any)}
                    className={cn(
                      "h-7 flex-shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium leading-tight transition-colors",
                      selectedType === filter.id
                        ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {filter.label}
                    {filter.count > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-1 h-3 px-1 text-xs font-medium leading-tight",
                          selectedType === filter.id
                            ? "border border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {filter.count}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {subStepModal.open ? (
        <Suspense fallback={null}>
          <ModalViewSubSteps
            open={subStepModal.open}
            onOpenChange={(open) => setSubStepModal(prev => ({ ...prev, open }))}
            parentStepId={subStepModal.parentStepId}
            parentStepTitle={subStepModal.parentStepTitle}
          />
        </Suspense>
      ) : null}
    </Card>
  );
};
