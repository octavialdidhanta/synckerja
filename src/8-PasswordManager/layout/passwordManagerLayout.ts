/** Kolom utama (stats + grid) — tinggi dibatasi agar halaman tidak memanjang. */
export const PASSWORD_MANAGER_MAIN_COLUMN =
  "flex h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-h-0 min-w-0 w-full flex-1 flex-col gap-2";

/** Grid 3+9 (kategori | daftar) mengisi sisa tinggi di bawah stats. */
export const PASSWORD_MANAGER_CONTENT_GRID =
  "grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch";

/** Panel — isi tinggi parent; scroll di dalam kartu. */
export const PASSWORD_MANAGER_PANEL_SECTION =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

export const PASSWORD_MANAGER_PANEL_CARD =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10";
