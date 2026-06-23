/** Grid 9+3 — selaras `/employees`. */
export const COMPANY_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

export const COMPANY_MAIN_COLUMN =
  'col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden';

export const COMPANY_SIDEBAR_COLUMN =
  'col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch';

/** Kartu tabel utama — tinggi minimum + flex grow (selaras EmployeePage). */
export const COMPANY_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

/** Footer tabel / sidebar — selaras EmployeeTableFooter / EmployeeSidebarFooter. */
export const COMPANY_CARD_FOOTER =
  'flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2';
