/** Grid — ritme tinggi /employees; header modul ikut scroll. */
export const SCRIPT_GENERATOR_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-1 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:grid-rows-1';

export const SCRIPT_GENERATOR_GRID_FORM_SHOWN =
  'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.33fr)]';

export const SCRIPT_GENERATOR_GRID_FORM_HIDDEN =
  'lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]';

/** Kartu panel — tinggi mengikuti parent; footer menempel bawah kartu hasil. */
export const SCRIPT_GENERATOR_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
