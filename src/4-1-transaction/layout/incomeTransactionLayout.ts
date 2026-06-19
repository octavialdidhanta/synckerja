/**
 * Grid transaction — `flex-1 min-h-0` mengisi sisa area di bawah HeaderAndTab.
 */
export const INCOME_TX_MAIN_GRID =
  'grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-rows-1';

/** Grid piutang — selaras `/employees` (min viewport height, stretch 9+3). */
export const INCOME_PIUTANG_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

export const INCOME_PIUTANG_MAIN_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9';

export const INCOME_PIUTANG_SIDEBAR_COLUMN =
  'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3';

/** Kartu tabel utama — sama di transaction & piutang (footer di dasar kolom). */
export const INCOME_TX_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
