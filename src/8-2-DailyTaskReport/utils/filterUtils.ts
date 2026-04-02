import { ComputedPerformanceRow } from "../context/ReportContext";

interface FilterConfig {
  search?: string;
  status?: "all" | "ontime" | "late";
  timePeriod?: "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
  customStart?: string | null;
  customEnd?: string | null;
  pic?: string;
  task?: string;
  step?: string;
  subStep?: string;
}

export function getDateRangeFromFilter(filters: FilterConfig): { start: Date | null; end: Date | null } {
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;
  if (filters.timePeriod === "all") return { start: null, end: null };
  switch (filters.timePeriod) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case "yesterday": {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      break;
    }
    case "this_week": {
      const day = now.getDay();
      const daysToMonday = day === 0 ? 6 : day - 1;
      start = new Date(now);
      start.setDate(now.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "custom":
      if (filters.customStart && filters.customEnd) {
        start = new Date(filters.customStart);
        end = new Date(filters.customEnd);
        end.setHours(23, 59, 59, 999);
      }
      break;
  }
  return { start, end };
}

export function filterPerformanceData(data: ComputedPerformanceRow[], filters: FilterConfig): ComputedPerformanceRow[] {
  let filtered = [...data];
  if (filters.timePeriod !== "all") {
    const { start, end } = getDateRangeFromFilter(filters);
    if (start) {
      filtered = filtered.filter((d) => {
        const ts = new Date(d.dueDate || d.assignedAt || "").getTime();
        if (Number.isNaN(ts)) return false;
        return ts >= start.getTime() && (end ? ts <= end.getTime() : true);
      });
    }
  }
  if (filters.status !== "all") filtered = filtered.filter((d) => (filters.status === "ontime" ? d.isOnTime === true : d.isOnTime === false));
  if (filters.pic && filters.pic !== "all") filtered = filtered.filter((d) => d.employeeName.toLowerCase().includes(filters.pic!.toLowerCase()));
  if (filters.task && filters.task !== "all") filtered = filtered.filter((d) => d.taskTitle.toLowerCase().includes(filters.task!.toLowerCase()));
  if (filters.step && filters.step !== "all") filtered = filtered.filter((d) => d.stepTitle.toLowerCase().includes(filters.step!.toLowerCase()));
  if (filters.subStep && filters.subStep !== "all") filtered = filtered.filter((d) => (d.subStepTitle || "").toLowerCase().includes(filters.subStep!.toLowerCase()));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter((d) => d.employeeName.toLowerCase().includes(q) || d.taskTitle.toLowerCase().includes(q) || d.stepTitle.toLowerCase().includes(q) || (d.subStepTitle || "").toLowerCase().includes(q));
  }
  return filtered;
}

export function filterBySearchAndFilters<T extends { taskTitle?: string; stepTitle?: string; subStepTitle?: string; description?: string; created_at?: string; created_by_employee?: { full_name?: string } }>(data: T[], filters: FilterConfig): T[] {
  let filtered = [...data];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter((item) => (item.taskTitle || "").toLowerCase().includes(q) || (item.stepTitle || "").toLowerCase().includes(q) || (item.subStepTitle || "").toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q));
  }
  if (filters.pic && filters.pic !== "all") filtered = filtered.filter((item) => (item.created_by_employee?.full_name || "").toLowerCase().includes(filters.pic!.toLowerCase()));
  if (filters.task && filters.task !== "all") filtered = filtered.filter((item) => (item.taskTitle || "").toLowerCase().includes(filters.task!.toLowerCase()));
  if (filters.step && filters.step !== "all") filtered = filtered.filter((item) => (item.stepTitle || "").toLowerCase().includes(filters.step!.toLowerCase()));
  if (filters.subStep && filters.subStep !== "all") filtered = filtered.filter((item) => (item.subStepTitle || "").toLowerCase().includes(filters.subStep!.toLowerCase()));
  if (filters.timePeriod !== "all") {
    const { start, end } = getDateRangeFromFilter(filters);
    if (start) {
      filtered = filtered.filter((item) => {
        if (!item.created_at) return false;
        const ts = new Date(item.created_at).getTime();
        return ts >= start.getTime() && (end ? ts <= end.getTime() : true);
      });
    }
  }
  return filtered;
}
