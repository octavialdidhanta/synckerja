/** Canonical route for mobile Daily Task shell (`DailyTaskPage`) and `DailyTaskRouteElement` in `App.tsx`. */
export const TOOLS_DAILY_TASK_PATH = "/tools/daily-task" as const;

/** Laporan / Report tab → `5-daily-task-report` + `DailyTaskReportRouteElement`. */
export const TOOLS_DAILY_TASK_REPORT_PATH = "/tools/daily-task-report" as const;

/** Mobile tools footer: Job Desc tab → same shell, `view=jobdesc` renders `android-mobile/5-job-desc/JobDescPage`. */
export const TOOLS_DAILY_TASK_JOBDESC_HREF = `${TOOLS_DAILY_TASK_PATH}?view=jobdesc` as const;

export function toolsDailyTaskHref(view: "initiative" | "jobdesc"): string {
  return `${TOOLS_DAILY_TASK_PATH}?view=${view}`;
}
