/** Grid — ritme tinggi /employees; header modul ikut scroll. */
export const INTEGRATIONS_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

export const INTEGRATIONS_FULL_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch';

export const INTEGRATIONS_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

export const INTEGRATIONS_COLUMNS_DEFAULT =
  'grid min-h-0 min-w-0 w-full flex-1 grid-cols-1 gap-2 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch';

export const INTEGRATIONS_COLUMNS_THREADS =
  'grid min-h-0 min-w-0 w-full flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] lg:items-stretch';
