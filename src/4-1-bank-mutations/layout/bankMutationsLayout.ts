/** Grid — stretch viewport; header modul di atas grid (dalam scroll shell). */
export const BANK_MUTATIONS_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

/** Section kartu tabel — isi flex-1 agar footer menempel di bawah kartu (selaras `/employees`). */
export const BANK_MUTATIONS_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

/** Area scroll isi tabel — sibling langsung di atas footer. */
export const BANK_MUTATIONS_TABLE_BODY_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
