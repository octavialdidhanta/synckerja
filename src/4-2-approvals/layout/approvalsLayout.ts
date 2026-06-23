/** Grid 9+3 — selaras `/expenses/reminder-bills`. */
export const APPROVALS_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px] xl:grid-rows-1 xl:items-stretch';

/** Kartu tabel utama (filter/metrik di atas, scroll internal di tbody). */
export const APPROVALS_TABLE_CARD =
  'flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';

export const APPROVALS_TABLE_BODY_SCROLL = 'min-h-0 min-w-0 flex-1 overflow-x-auto';
