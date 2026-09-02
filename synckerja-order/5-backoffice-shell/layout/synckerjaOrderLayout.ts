/** Grid — ritme tinggi /employees; header modul ikut scroll. */
export const SYNCKERJA_ORDER_MAIN_GRID =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch";

/** Kartu utama — tinggi mengikuti parent; footer menempel bawah kartu seperti /employees. */
export const SYNCKERJA_ORDER_TABLE_SECTION =
  "flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]";

export const SYNCKERJA_ORDER_PANEL_BODY =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
