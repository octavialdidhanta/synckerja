/**
 * Grid transaction & piutang — `flex-1 min-h-0` mengisi sisa area di bawah HeaderAndTab
 * (tanpa `min-h-[calc(100vh-…)]` / `flex-none` yang meninggalkan strip abu di bawah footer).
 */
export const INCOME_TX_MAIN_GRID =
  'grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-rows-1';

/** Kartu tabel utama — sama di transaction & piutang (footer di dasar kolom). */
export const INCOME_TX_TABLE_SECTION =
  'flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]';
