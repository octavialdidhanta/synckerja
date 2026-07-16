/** Grid isi halaman list — isi sisa viewport agar card tabel + footer menempel bawah. */
export const LEAD_MAGNET_MAIN_GRID =
  'grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch';

/** Wrapper card tabel — flex-1 + min-height responsif mengisi sisa grid row. */
export const LEAD_MAGNET_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
