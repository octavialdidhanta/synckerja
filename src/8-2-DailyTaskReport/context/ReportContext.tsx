import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { logger } from "@/shared/lib/logger";
import { getCached, setCache } from "@/8-2-DailyTask/utils/optimizationUtils";
import { filterBySearchAndFilters, filterPerformanceData, getDateRangeFromFilter } from "../utils/filterUtils";
import { isEmployeeActive } from "@/2-1-employees/utils/employeeUtils";

export interface AssignmentRow {
  id: string;
  type: "step" | "substep";
  task_step_id?: string;
  task_steps_to_steps_id?: string;
  task_steps_to_steps_assigned_id?: string;
  assigned_at: string;
  employee: { id: string; full_name: string; email?: string; pending_removal?: boolean | null; employee_statuses?: { name: string } | null } | null;
  step: { id: string; title: string; updated_at: string | null; completed_at: string | null; is_completed: boolean; task?: { id: string; title: string } } | null;
  subStep?: { id: string; title: string; parent_step_id: string; is_completed: boolean; completed_at: string | null } | null;
  due_date: string | null;
}

export interface ComputedPerformanceRow {
  assignmentId: string;
  employeeId: string | null;
  employeeName: string;
  stepId: string | null;
  stepTitle: string;
  taskTitle: string;
  assignedAt: string | null;
  dueDate: string | null;
  finishedAt: string | null;
  isCompleted: boolean;
  isOnTime: boolean | null;
  lateDays: number | null;
  subStepTitle?: string | null;
  subStepId?: string | null;
  type?: "step" | "substep";
  employeeIsActive: boolean;
}

export interface ReportContextType {
  initialLoading: boolean;
  loading: boolean;
  performance: ComputedPerformanceRow[];
  filtered: ComputedPerformanceRow[];
  blockers: any[];
  recentUpdates: any[];
  filteredBlockers: any[];
  filteredRecentUpdates: any[];
  filters: { search: string; status: "all" | "ontime" | "late"; timePeriod: "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"; customStart?: string | null; customEnd?: string | null; pic?: string; task?: string; step?: string; subStep?: string };
  updateFilter: (key: "search" | "status" | "timePeriod" | "customStart" | "customEnd" | "pic" | "task" | "step" | "subStep", value: string) => void;
  options: { pics: string[]; tasks: string[]; steps: string[]; subSteps: string[] };
  getBlockersForStep: (stepId: string) => any[];
  formatDateRangeDisplay: () => string;
  refreshError: string | null;
  retryRefresh: () => void;
  refreshReport: () => Promise<void>;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const useDailyTaskReport = () => {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useDailyTaskReport must be used within DailyTaskReportProvider");
  return ctx;
};

export const DailyTaskReportProvider = ({ children }: { children: React.ReactNode }) => {
  const { organizationId, loading: organizationLoading } = useCurrentOrg();
  const [loading, setLoading] = useState(true);
  const [lastLoadedOrgId, setLastLoadedOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ search: "", status: "all", timePeriod: "this_week", customStart: null, customEnd: null, pic: "all", task: "all", step: "all", subStep: "all" });
  const [blockersByStep, setBlockersByStep] = useState<Record<string, any[]>>({});
  const isLoadingOrgRef = useRef(false);
  const inFlightOrgRef = useRef<string | null>(null);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationLoading) {
      setLoading(true);
      return;
    }
    if (!organizationId) return;
    if (isLoadingOrgRef.current && inFlightOrgRef.current === organizationId) return;
    isLoadingOrgRef.current = true;
    inFlightOrgRef.current = organizationId;
    let isActive = true;

    const load = async () => {
      setRefreshError(null);
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const cacheKey = `report_${organizationId}_${user.id}`;
          const cached = getCached<{ rows: AssignmentRow[]; blockers: any[]; recentUpdates: any[] }>(cacheKey, 60000);
          if (cached) {
            if (!isActive) return;
            setRows(cached.rows || []);
            setBlockers(cached.blockers || []);
            setRecentUpdates(cached.recentUpdates || []);
            setLastLoadedOrgId(organizationId);
            setLoading(false);
            return;
          }
        }

        const stepAssignsResult = await supabase
          .from("task_steps_assigned")
          .select("id, task_step_id, assigned_at, employee:employees!employee_id(id, full_name, email, pending_removal, employee_statuses(name)), step:task_steps(id, title, updated_at, completed_at, is_completed, task:daily_tasks(id, title)), task_steps_assigned_duedate(due_date, created_at)")
          .eq("organization_id", organizationId)
          .limit(1000);
        if (stepAssignsResult.error) throw stepAssignsResult.error;

        const stepMapped: AssignmentRow[] = (stepAssignsResult.data || []).map((a: any) => ({
          id: a.id,
          type: "step",
          task_step_id: a.task_step_id,
          assigned_at: a.assigned_at,
          employee: a.employee || null,
          step: a.step || null,
          due_date: (a.task_steps_assigned_duedate || []).sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0]?.due_date || null,
        }));
        const stepIds = [...new Set(stepMapped.map((r) => r.step?.id).filter(Boolean))] as string[];
        const taskIds = [...new Set(stepMapped.map((r) => r.step?.task?.id).filter(Boolean))] as string[];

        const [subStepRowsResult, historyResult] = await Promise.all([
          stepIds.length > 0
            ? supabase
                .from("task_steps_to_steps")
                .select("id, title, parent_step_id")
                .in("parent_step_id", stepIds)
                .limit(5000)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("task_step_history")
            .select(
              "id, task_step_id, task_steps_to_steps_id, action_type, old_value, new_value, description, blocker_type, created_by, created_at, is_resolved, task_id",
            )
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(5000),
        ]);

        if (historyResult.error) throw historyResult.error;

        const subSteps = (subStepRowsResult.data || []) as any[];
        const subStepMap = new Map<string, any>(subSteps.map((s) => [s.id, s]));

        const stepMap = new Map<string, any>(
          stepMapped
            .map((r) => r.step)
            .filter(Boolean)
            .map((s: any) => [s.id, s]),
        );

        const taskMap = new Map<string, string>(
          stepMapped
            .map((r) => r.step?.task)
            .filter(Boolean)
            .map((t: any) => [t.id, t.title]),
        );

        // Fallback for task titles not present on assignment rows.
        if (taskIds.length > 0) {
          const tasksResult = await supabase
            .from("daily_tasks")
            .select("id, title")
            .in("id", taskIds)
            .limit(2000);
          (tasksResult.data || []).forEach((t: any) => taskMap.set(t.id, t.title));
        }

        const assignmentMapByStep = new Map<string, string>();
        stepMapped.forEach((r) => {
          if (r.task_step_id && r.assigned_at && !assignmentMapByStep.has(r.task_step_id)) {
            assignmentMapByStep.set(r.task_step_id, r.assigned_at);
          }
        });

        const historyRows = (historyResult.data || []) as any[];

        const enrichedHistory = historyRows.map((h) => {
          const sub = h.task_steps_to_steps_id ? subStepMap.get(h.task_steps_to_steps_id) : null;
          const parentStepId = h.task_step_id || sub?.parent_step_id || null;
          const step = parentStepId ? stepMap.get(parentStepId) : null;
          const taskTitle = taskMap.get(h.task_id || step?.task?.id) || step?.task?.title || "-";
          return {
            ...h,
            taskTitle,
            stepTitle: step?.title || "-",
            subStepTitle: sub?.title || null,
            assignedAt: parentStepId ? assignmentMapByStep.get(parentStepId) || null : null,
          };
        });

        const unresolvedBlockers = enrichedHistory.filter(
          (h) => h.action_type === "blocker_added" && (h.is_resolved === null || h.is_resolved === false),
        );

        const byStep: Record<string, any[]> = {};
        unresolvedBlockers.forEach((b) => {
          const parentStepId = b.task_step_id || subStepMap.get(b.task_steps_to_steps_id)?.parent_step_id;
          if (!parentStepId) return;
          (byStep[parentStepId] = byStep[parentStepId] || []).push(b);
        });

        const recent = enrichedHistory.filter((h) => h.action_type !== "blocker_added").slice(0, 300);

        if (!isActive) return;
        setRows(stepMapped);
        setBlockers(unresolvedBlockers);
        setRecentUpdates(recent);
        setBlockersByStep(byStep);
        setLastLoadedOrgId(organizationId);

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setCache(`report_${organizationId}_${user.id}`, {
              rows: stepMapped,
              blockers: unresolvedBlockers,
              recentUpdates: recent,
            });
          }
        } catch (cacheError) {
          logger.warn("Failed to save cache", cacheError);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadRef.current = load;
    void load().finally(() => {
      if (isActive) {
        isLoadingOrgRef.current = false;
        inFlightOrgRef.current = null;
      }
    });
    return () => {
      isActive = false;
    };
  }, [organizationId, organizationLoading]);

  const performance = useMemo<ComputedPerformanceRow[]>(
    () =>
      rows.map((r) => {
        const emp = r.employee;
        const employeeIsActive = emp
          ? isEmployeeActive({ status: null, pending_removal: emp.pending_removal ?? null, employee_status_name: emp.employee_statuses?.name ?? null })
          : false;
        const due = r.due_date ? new Date(r.due_date) : null;
        const finishedAt = r.step?.completed_at || null;
        const isCompleted = !!r.step?.is_completed;
        const finished = finishedAt ? new Date(finishedAt) : null;
        let isOnTime: boolean | null = null;
        let lateDays: number | null = null;
        if (due && finished) {
          const dueEnd = new Date(due);
          dueEnd.setHours(23, 59, 59, 999);
          if (finished.getTime() <= dueEnd.getTime()) {
            isOnTime = true;
            lateDays = 0;
          } else {
            isOnTime = false;
            lateDays = Math.ceil((finished.getTime() - dueEnd.getTime()) / (24 * 60 * 60 * 1000));
          }
        }
        return {
          assignmentId: r.id,
          employeeId: r.employee?.id || null,
          employeeName: r.employee?.full_name || "Unknown",
          stepId: r.step?.id || null,
          stepTitle: r.step?.title || "-",
          taskTitle: r.step?.task?.title || "-",
          assignedAt: r.assigned_at || null,
          dueDate: r.due_date,
          finishedAt,
          isCompleted,
          isOnTime,
          lateDays,
          subStepTitle: r.subStep?.title || null,
          subStepId: r.subStep?.id || null,
          type: r.type,
          employeeIsActive,
        };
      }),
    [rows],
  );

  const filtered = useMemo(() => filterPerformanceData(performance, filters), [performance, filters]);
  const filteredBlockers = useMemo(() => filterBySearchAndFilters(blockers, filters), [blockers, filters]);
  const filteredRecentUpdates = useMemo(() => filterBySearchAndFilters(recentUpdates, filters), [recentUpdates, filters]);

  const updateFilter = useCallback((key: any, value: string) => setFilters((prev: any) => ({ ...prev, [key]: value as any })), []);
  const formatDateRangeDisplay = useCallback(() => {
    if (filters.timePeriod === "all") return "";
    const { start, end } = getDateRangeFromFilter(filters);
    if (!start) return "";
    if (filters.timePeriod === "today" || filters.timePeriod === "yesterday") return start.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    if (!end) return "";
    const startFormatted = start.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const endFormatted = end.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    return `${startFormatted} - ${endFormatted}`;
  }, [filters]);
  const retryRefresh = useCallback(() => {
    setRefreshError(null);
    void loadRef.current?.();
  }, []);
  const refreshReport = useCallback(async () => {
    setRefreshError(null);
    await loadRef.current?.();
  }, []);
  const getBlockersForStep = useCallback((stepId: string) => blockersByStep[stepId] || [], [blockersByStep]);

  const options = useMemo(() => {
    const base = [...performance];
    const pics = Array.from(new Set(base.filter((p) => p.employeeId && p.employeeIsActive).map((p) => p.employeeName).filter(Boolean))).sort();
    const tasks = Array.from(new Set(base.map((p) => p.taskTitle).filter(Boolean))).sort();
    const steps = Array.from(new Set(base.filter((p) => (filters.task && filters.task !== "all" ? p.taskTitle === filters.task : true)).map((p) => p.stepTitle).filter(Boolean))).sort();
    const subSteps = Array.from(new Set(base.filter((p) => (filters.task && filters.task !== "all" ? p.taskTitle === filters.task : true)).filter((p) => (filters.step && filters.step !== "all" ? p.stepTitle === filters.step : true)).map((p) => p.subStepTitle || "").filter(Boolean))).sort();
    return { pics, tasks, steps, subSteps };
  }, [performance, filters.task, filters.step]);

  const initialLoading =
    organizationLoading || (Boolean(organizationId) && lastLoadedOrgId !== organizationId);

  const value = useMemo<ReportContextType>(
    () => ({ initialLoading, loading, performance, filtered, blockers, recentUpdates, filteredBlockers, filteredRecentUpdates, filters, updateFilter, getBlockersForStep, formatDateRangeDisplay, refreshError, retryRefresh, refreshReport, options }),
    [initialLoading, loading, performance, filtered, blockers, recentUpdates, filteredBlockers, filteredRecentUpdates, filters, updateFilter, getBlockersForStep, formatDateRangeDisplay, refreshError, retryRefresh, refreshReport, options],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
};

