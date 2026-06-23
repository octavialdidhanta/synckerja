/** Grid 9+3 — selaras `/expenses/reminder-bills`. */
export const DAILY_TASK_REPORT_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px] xl:grid-rows-1 xl:items-stretch';

export const DAILY_TASK_REPORT_TABLE_CARD =
  'flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

export const DAILY_TASK_REPORT_PERFORMANCE_CARD =
  'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10';

export const DAILY_TASK_REPORT_SIDEBAR_CARD =
  'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10';

/** Scroll wrapper — selaras [DailyTaskReportModuleShell](../layout/DailyTaskReportModuleShell.tsx). */
export const DAILY_TASK_REPORT_MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

