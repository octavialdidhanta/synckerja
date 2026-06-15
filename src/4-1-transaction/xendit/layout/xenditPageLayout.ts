/** Grid Xendit — ritme tinggi /employees; scroll halaman tipis (header ikut), footer tetap di bawah kartu. */
export const XENDIT_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch';

/** Kartu utama — tinggi mengikuti parent; footer menempel bawah kartu seperti /employees. */
export const XENDIT_TABLE_SECTION =
  'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

export const XENDIT_MAIN_INNER_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
