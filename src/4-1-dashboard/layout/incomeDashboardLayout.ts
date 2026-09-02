/** Grid konten utama Income Dashboard — selaras `/employees` (9+3, stretch, min viewport height). */
export const INCOME_DASHBOARD_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

export const INCOME_DASHBOARD_MAIN_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-9';

/** Kartu utama / sidebar — ritme tinggi /employees; footer menempel bawah kartu. */
export const INCOME_DASHBOARD_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

/** Recent Income sidebar — fixed to grid row height (same as employees col-span-3). */
export const INCOME_DASHBOARD_RECENT_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3';

export const INCOME_DASHBOARD_RECENT_PANEL =
  'flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm';

export const INCOME_DASHBOARD_RECENT_PANEL_BODY = 'flex-1 min-h-0 overflow-hidden';

export const INCOME_DASHBOARD_RECENT_PANEL_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain h-full min-h-0 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
