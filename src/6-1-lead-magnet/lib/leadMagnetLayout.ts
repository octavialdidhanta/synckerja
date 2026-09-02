/** Grid — ritme tinggi /employees; header modul ikut scroll. */
export const LEAD_MAGNET_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

export const LEAD_MAGNET_FULL_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch';

export const LEAD_MAGNET_ANALYTICS_SIDEBAR_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch lg:col-span-5';

export const LEAD_MAGNET_ANALYTICS_MAIN_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch lg:col-span-7';

/** Kartu utama / sidebar — tinggi mengikuti parent; footer menempel bawah kartu. */
export const LEAD_MAGNET_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
