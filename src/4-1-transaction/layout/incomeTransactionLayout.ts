/** Grid transaction — kolom kiri + sidebar, tinggi mengikuti konten (bukan flex-1 penuh viewport). */
export const INCOME_TX_MAIN_GRID =
  'grid min-h-0 min-w-0 w-full grid-cols-1 gap-2 items-start xl:grid-cols-12 xl:items-stretch';

export const INCOME_TX_MAIN_COLUMN = 'col-span-12 min-w-0 xl:col-span-9';

export const INCOME_TX_SIDEBAR_COLUMN =
  'col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden xl:col-span-3 xl:h-full xl:max-h-full';

/** Kartu tabel utama — tinggi tetap, scroll internal (selaras payroll / employees). */
export const INCOME_TX_TABLE_SECTION =
  'flex h-[calc(100dvh-280px)] min-h-[560px] min-w-0 flex-col [@media(max-height:900px)]:h-[calc(100dvh-300px)] [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:h-[calc(100dvh-320px)] [@media(max-height:760px)]:min-h-[680px]';

/** Grid piutang — alias transaction (scroll natural, tidak stretch viewport). */
export const INCOME_PIUTANG_MAIN_GRID = INCOME_TX_MAIN_GRID;

export const INCOME_PIUTANG_MAIN_COLUMN = INCOME_TX_MAIN_COLUMN;

export const INCOME_PIUTANG_SIDEBAR_COLUMN = INCOME_TX_SIDEBAR_COLUMN;
