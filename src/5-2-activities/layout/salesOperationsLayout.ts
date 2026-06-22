/** Grid sales ops — kolom kiri + sidebar, scroll halaman natural (selaras incomes/transaction). */
export const SALES_OPS_MAIN_GRID =
  'grid min-h-0 min-w-0 w-full grid-cols-1 gap-2 items-start xl:grid-cols-12 xl:items-stretch';

export const SALES_OPS_MAIN_COLUMN = 'col-span-12 min-w-0 xl:col-span-9';

export const SALES_OPS_SIDEBAR_COLUMN =
  'col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden xl:col-span-3 xl:h-full xl:max-h-full';

/** Kartu tabel utama — tinggi tetap, scroll internal. */
export const SALES_OPS_TABLE_SECTION =
  'flex h-[calc(100dvh-280px)] min-h-[560px] min-w-0 flex-col [@media(max-height:900px)]:h-[calc(100dvh-300px)] [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:h-[calc(100dvh-320px)] [@media(max-height:760px)]:min-h-[680px]';

/** Footer tabel / sidebar — selaras jadwal-kunjungan (`py-2`, `bg-gray-50`). */
export const SALES_OPS_CARD_FOOTER =
  'flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2';
