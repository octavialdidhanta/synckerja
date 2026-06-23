export const ATTENDANCE_SETTINGS_SCROLL_PANE =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Grid 3+9 — tinggi tetap `lg:max-h` / `lg:h-full` dipertahankan. */
export const ATTENDANCE_SETTINGS_GRID =
  'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden';

export const ATTENDANCE_SETTINGS_NAV_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden md:col-span-3 lg:h-full';

export const ATTENDANCE_SETTINGS_MAIN_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden md:col-span-9 lg:h-full';

export const ATTENDANCE_SETTINGS_CARD_HEADER =
  'flex-shrink-0 border-b border-border px-4 py-1.5';

/** Footer kartu — selaras EmployeeTableFooter / EmployeeSidebarFooter. */
export const ATTENDANCE_SETTINGS_CARD_FOOTER =
  'flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2';
