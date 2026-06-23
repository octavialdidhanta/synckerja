/** Grid 9+3 — selaras `/employees`; tetap stack di bawah `xl`. */
export const PAYROLL_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-start xl:grid-cols-12 xl:items-stretch';

export const PAYROLL_MAIN_COLUMN =
  'flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9';

/** Jangan ubah — tinggi tetap tabel utama payroll calculations. */
export const PAYROLL_TABLE_SHELL_HEIGHT =
  'flex h-[calc(100dvh-280px)] min-h-[560px] min-w-0 flex-col [@media(max-height:900px)]:h-[calc(100dvh-300px)] [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:h-[calc(100dvh-320px)] [@media(max-height:760px)]:min-h-[680px]';

/** Jangan ubah — tinggi tetap section sidebar kanan. */
export const PAYROLL_SIDEBAR_COLUMN =
  'flex min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden xl:col-span-3 xl:h-full xl:max-h-full';

export const PAYROLL_CARD_FOOTER =
  'flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2';
