/** Grid mutasi rekening — isi sisa viewport di bawah header (tanpa min-h viewport yang memanjangkan halaman). */
export const BANK_MUTATIONS_MAIN_GRID =
  'grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

/** Kartu tabel utama — tinggi mengikuti parent; scroll hanya di body tabel. */
export const BANK_MUTATIONS_TABLE_SECTION =
  'flex h-full min-h-[560px] min-w-0 max-h-full flex-1 flex-col overflow-hidden [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
