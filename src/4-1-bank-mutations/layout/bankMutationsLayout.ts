/** Grid — ritme tinggi selaras modul finance lain; scroll ditangani shell. */
export const BANK_MUTATIONS_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]';

/** Kartu tabel — isi boleh tumbuh; parent shell yang scroll. */
export const BANK_MUTATIONS_TABLE_SECTION = 'flex min-w-0 flex-1 flex-col';
