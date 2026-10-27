/** Grid — isi sisa tinggi shell (bukan min-h yang mendorong halaman memanjang). */
export const LIBRARY_MAIN_GRID =
  "grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch overflow-hidden";

/** Kartu utama — tinggi = parent; scroll hanya di dalam tabel, footer tetap di bawah kartu. */
export const LIBRARY_TABLE_SECTION =
  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden";
