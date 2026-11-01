/**
 * Grid 9+3 mengisi sisa tinggi di bawah header modul.
 * Tinggi dikunci ke viewport agar baris tabel tidak memanjangkan halaman.
 * Di bawah `xl`, tabel dan sidebar berbagi tinggi (dua baris) dan tetap di dalam viewport.
 */
export const DAILY_TASK_REPORT_MAIN_GRID =
  'grid h-full min-h-0 max-h-full min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)_minmax(0,1fr)] items-stretch xl:grid-rows-1 xl:items-stretch';

/** Kartu tabel mengisi sisa tinggi di bawah overview + filter; scroll ada di dalam tabel. */
export const DAILY_TASK_REPORT_TABLE_CARD =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

export const DAILY_TASK_REPORT_PERFORMANCE_CARD =
  'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10';

export const DAILY_TASK_REPORT_SIDEBAR_CARD =
  'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10';

/** Kolom utama — mengisi shell, tidak memanjang mengikuti jumlah baris. */
export const DAILY_TASK_REPORT_MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

