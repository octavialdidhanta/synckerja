import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, startOfDay } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";
import { Badge } from "@/features/ui/badge";
import { Separator } from "@/features/ui/separator";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { cn } from "@/lib/utils";
import { JobDescAssignment, JobDescEmployeeSummary } from "./types";
import { useDailyTask } from "@/features/8-2-DailyTask/DailyTaskContext";
import { ModalViewSubSteps } from "@/features/8-2-DailyTask/section/ModalViewSubSteps";
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/config/logger';

interface JobDescEmployeeCardProps {
  summary: JobDescEmployeeSummary;
}

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

export const JobDescEmployeeCard = ({ summary }: JobDescEmployeeCardProps) => {
  const { t, language } = useAppTranslation();
  const locale = language === "id" ? indonesianLocale : undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const { setFilters, navigateToTask, setExpandedTasks, scrollToStep } = useDailyTask();
  
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

  // Cache untuk performance optimization (ref agar callback stabil)
  const stepIdCacheRef = useRef<Map<string, string>>(new Map());
  const parentStepIdCacheRef = useRef<Map<string, string>>(new Map());

  // Helper function untuk mendapatkan stepId dari assignmentId (dengan cache)
  const getStepId = useCallback(async (assignmentId: string): Promise<string | null> => {
    const cache = stepIdCacheRef.current;
    if (cache.has(assignmentId)) {
      return cache.get(assignmentId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('task_steps_assigned')
        .select('task_step_id')
        .eq('id', assignmentId)
        .maybeSingle();

      if (error || !data) return null;

      const stepId = data.task_step_id;
      cache.set(assignmentId, stepId);
      return stepId;
    } catch (error) {
      devLog.warn('JobDescEmployeeCard: fetch stepId failed', error);
      return null;
    }
  }, []);

  // Helper function untuk mendapatkan parentStepId dari assignmentId (dengan cache)
  const getParentStepId = useCallback(async (assignmentId: string): Promise<string | null> => {
    const cache = parentStepIdCacheRef.current;
    if (cache.has(assignmentId)) {
      return cache.get(assignmentId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('task_steps_to_steps_assigned')
        .select(`
          task_steps_to_steps_id,
          task_steps_to_steps!inner(parent_step_id)
        `)
        .eq('id', assignmentId)
        .maybeSingle();

      if (error || !data) return null;

      const parentStepId = (data as { task_steps_to_steps?: { parent_step_id?: string | null } | null }).task_steps_to_steps?.parent_step_id ?? null;
      if (parentStepId) {
        cache.set(assignmentId, parentStepId);
        return parentStepId;
      }
      return null;
    } catch (error) {
      devLog.warn('JobDescEmployeeCard: fetch parentStepId failed', error);
      return null;
    }
  }, []);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Handle click pada task title
  const handleTaskTitleClick = useCallback(async (assignment: JobDescAssignment) => {
    if (assignment.type === 'task') {
      // Task Title Click: search dengan taskTitle, tampilkan semua step
      const searchTitle = assignment.title || assignment.taskTitle;
      setFilters(prev => ({
        ...prev,
        search: searchTitle
      }));
      navigateToTask(assignment.taskId);
      
    } else if (assignment.type === 'step') {
      // Step Title Click: search dengan stepTitle, tampilkan hanya step spesifik
      setFilters(prev => ({
        ...prev,
        search: assignment.stepTitle ?? ''
      }));
      
      // Query stepId untuk scroll ke step spesifik
      const stepId = await getStepId(assignment.assignmentId);
      
      // Expand task
      setExpandedTasks(prev => new Set([...prev, assignment.taskId]));
      
      // Scroll ke step jika stepId ditemukan
      if (stepId) {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          scrollToStep(stepId);
        }, 300); // Delay untuk memastikan task sudah expanded
      } else {
        // Fallback: navigate biasa jika stepId tidak ditemukan
        navigateToTask(assignment.taskId);
      }
      
    } else if (assignment.type === 'subStep') {
      // Sub-step Title Click: search dengan stepTitle (parent), buka modal, scroll ke parent step
      setFilters(prev => ({
        ...prev,
        search: assignment.stepTitle
      }));
      
      // Query parentStepId untuk buka modal dan scroll
      const parentStepId = await getParentStepId(assignment.assignmentId);
      
      if (parentStepId) {
        setSubStepModal({
          open: true,
          parentStepId: parentStepId,
          parentStepTitle: assignment.stepTitle,
        });
        
        // Expand task
        setExpandedTasks(prev => new Set([...prev, assignment.taskId]));
        
        // Scroll ke parent step
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          scrollToStep(parentStepId);
        }, 300);
      } else {
        // Fallback: expand task saja jika parentStepId tidak ditemukan
        setExpandedTasks(prev => new Set([...prev, assignment.taskId]));
        navigateToTask(assignment.taskId);
      }
    }
    // On mobile Job Desc view, switch to daily task so user sees the task list
    if (location.pathname === "/tools/daily-task" && new URLSearchParams(location.search).get("view") === "jobdesc") {
      navigate("/tools/daily-task");
    }
  }, [location.pathname, location.search, navigate, setFilters, navigateToTask, setExpandedTasks, scrollToStep, getStepId, getParentStepId]);

  const assignmentsToShow = summary.activeAssignments.length
    ? summary.activeAssignments
    : summary.assignments.slice(0, 3);

  const completedAssignments = useMemo(
    () => summary.assignments.filter(assignment => assignment.completedInRange),
    [summary.assignments],
  );

  const statusBadge = summary.idle
    ? {
        label: t("dailyTask.jobDesc.status.idle", "Idle"),
        className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      }
    : {
        label: t("dailyTask.jobDesc.status.busy", "Busy"),
        className: "bg-amber-100 text-amber-700 border border-amber-200",
      };

  const summaryStats = useMemo(
    () => [
      {
        label: t("dailyTask.jobDesc.metrics.tasks", "Tugas"),
        value: summary.totalTasks,
      },
      {
        label: t("dailyTask.jobDesc.metrics.steps", "Langkah"),
        value: summary.totalSteps,
      },
      {
        label: t("dailyTask.jobDesc.metrics.subSteps", "Sub-step"),
        value: summary.totalSubSteps,
      },
    ],
    [summary.totalSteps, summary.totalSubSteps, summary.totalTasks, t],
  );

  const dueStatusMeta = useMemo(
    () => ({
      overdue: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.overdue", "Terlambat"),
        className: "bg-red-100 text-red-700 border-red-200",
      },
      dueSoon: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.dueSoon", "Jelang jatuh tempo"),
        className: "bg-amber-100 text-amber-700 border-amber-200",
      },
      onTrack: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.onTrack", "On track"),
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      },
      noDue: {
        label: t("dailyTask.jobDesc.assignment.dueStatus.noDue", "Tanpa due date"),
        className: "bg-gray-100 text-gray-600 border-gray-200",
      },
    }),
    [t],
  );

  return (
    <div className="border-2 border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-gray-900">{summary.name}</p>
          {summary.jobTitle && (
            <p className="text-xs text-gray-500">{summary.jobTitle}</p>
          )}
          {summary.lastAssignedAt && (
            <p className="text-[11px] text-gray-400">
              {t("dailyTask.jobDesc.lastAssigned", "Terakhir assign {{date}}", {
                date: formatDate(summary.lastAssignedAt, "-"),
              })}
            </p>
          )}
        </div>
        <Badge className={cn("text-[11px] font-medium", statusBadge.className)}>
          {statusBadge.label}
        </Badge>
      </div>

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {summaryStats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs font-semibold text-gray-900">{stat.value}</p>
            <p className="text-[11px] text-gray-500">{stat.label}</p>
          </div>
        ))}
        <div>
          <p className="text-xs font-semibold text-gray-900">{completedAssignments.length}</p>
          <p className="text-[11px] text-gray-500">
            {t("dailyTask.jobDesc.metrics.completed", "Selesai")}
          </p>
        </div>
      </div>

      <Separator className="my-3" />

      {assignmentsToShow.length === 0 ? (
        <p className="text-xs text-gray-500">
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
                ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                : "text-amber-600 bg-amber-50 border-amber-100";

            return (
              <div
                key={`${assignment.assignmentId}-${assignment.type}`}
                className="border-2 border-gray-200 rounded-md p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p 
                        className="font-semibold text-gray-900 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleTaskTitleClick(assignment)}
                        title="Click to search and view this task"
                      >
                        {taskTitle}
                      </p>
                      {assignment.isRejected && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                          {t("dailyTask.approval.revisionBadge", "Revision")}
                        </Badge>
                      )}
                    </div>
                    {extraLabel && (
                      <p 
                        className="text-[11px] text-gray-500 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleTaskTitleClick(assignment)}
                        title="Click to search and view this task"
                      >
                        {extraLabel}
                      </p>
                    )}
                    {assignment.rejectReason && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
                        <p className="font-medium text-amber-800">
                          {t("dailyTask.approval.reasonForRejectionLabel", "Reason for Rejection")}
                        </p>
                        <p className="text-gray-700 mt-0.5">{assignment.rejectReason}</p>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[10px]">
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
                    <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-[10px] text-red-700">
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

      {completedAssignments.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompleted((prev) => !prev)}
            className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
          >
            {showCompleted
              ? t("dailyTask.jobDesc.completed.hide", "Sembunyikan tugas selesai")
              : t("dailyTask.jobDesc.completed.showAll", "Lihat {{count}} tugas selesai", {
                  count: completedAssignments.length,
                })}
          </button>
          {showCompleted && (
            <div className="mt-2 space-y-2">
              {completedAssignments.map((assignment) => {
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
                    className="border-2 border-green-200 bg-green-50 rounded-md p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p 
                            className="font-semibold text-gray-900 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleTaskTitleClick(assignment)}
                            title="Click to search and view this task"
                          >
                            {completedTitle || assignment.taskTitle}
                          </p>
                          {assignment.isRejected && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                              {t("dailyTask.approval.revisionBadge", "Revision")}
                            </Badge>
                          )}
                        </div>
                        {assignment.rejectReason && (
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
                            <p className="font-medium text-amber-800">
                              {t("dailyTask.approval.reasonForRejectionLabel", "Reason for Rejection")}
                            </p>
                            <p className="text-gray-700 mt-0.5">{assignment.rejectReason}</p>
                          </div>
                        )}
                        {assignment.type === "subStep" && assignment.stepTitle && (
                          <p className="text-[11px] text-gray-500">
                            {t("dailyTask.jobDesc.assignment.parentStep", "Step: {{title}}", {
                              title: assignment.stepTitle,
                            })}
                          </p>
                        )}
                        {assignment.type !== "task" && assignment.taskTitle && (
                          <p className="text-[11px] text-gray-500">
                            {t("dailyTask.jobDesc.assignment.parentTask", "Task: {{title}}", {
                              title: assignment.taskTitle,
                            })}
                          </p>
                        )}
                        {assignment.dueDate && (
                          <p className="text-[11px] text-gray-500">
                            {t("dailyTask.jobDesc.assignment.due", "Due {{date}}", {
                              date: formatDate(assignment.dueDate, "-"),
                            })}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500">
                          {assignment.completedAt
                            ? t("dailyTask.jobDesc.assignment.completedOn", "Selesai {{date}}", {
                                date: formatDate(assignment.completedAt, "-"),
                              })
                            : t("dailyTask.jobDesc.assignment.completed", "Selesai")}
                        </p>
                      </div>
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                        {t("dailyTask.jobDesc.assignment.completed", "Selesai")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[10px]">
                        {typeLabel}
                      </span>
                      {isLateCompletion && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-[10px] text-red-700">
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

      {/* Sub-step Modal */}
      <ModalViewSubSteps
        open={subStepModal.open}
        onOpenChange={(open) => setSubStepModal(prev => ({ ...prev, open }))}
        parentStepId={subStepModal.parentStepId}
        parentStepTitle={subStepModal.parentStepTitle}
      />
    </div>
  );
};
