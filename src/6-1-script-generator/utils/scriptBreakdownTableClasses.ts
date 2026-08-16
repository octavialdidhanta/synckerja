import { cn } from '@/shared/lib/utils';

const TABLE_BASE =
  'min-w-full table-fixed divide-y divide-x divide-gray-200 text-sm';

/** Kolom 1 Timing, 2 Visual (16rem), 3 VO, 4+ sisanya seragam; teks membungkus di dalam lebar tetap. */
const COL_WIDTHS_MARKDOWN =
  '[&_th:nth-child(1)]:w-[5.5rem] [&_th:nth-child(1)]:min-w-[5.5rem] [&_th:nth-child(1)]:max-w-[5.5rem] ' +
  '[&_td:nth-child(1)]:w-[5.5rem] [&_td:nth-child(1)]:min-w-[5.5rem] [&_td:nth-child(1)]:max-w-[5.5rem] ' +
  '[&_th:nth-child(2)]:w-[16rem] [&_th:nth-child(2)]:min-w-[16rem] [&_th:nth-child(2)]:max-w-[16rem] ' +
  '[&_td:nth-child(2)]:w-[16rem] [&_td:nth-child(2)]:min-w-[16rem] [&_td:nth-child(2)]:max-w-[16rem] ' +
  '[&_th:nth-child(3)]:w-[15rem] [&_th:nth-child(3)]:min-w-[15rem] [&_th:nth-child(3)]:max-w-[15rem] ' +
  '[&_td:nth-child(3)]:w-[15rem] [&_td:nth-child(3)]:min-w-[15rem] [&_td:nth-child(3)]:max-w-[15rem] ' +
  '[&_th:nth-child(n+4)]:w-[11rem] [&_th:nth-child(n+4)]:min-w-[11rem] [&_th:nth-child(n+4)]:max-w-[11rem] ' +
  '[&_td:nth-child(n+4)]:w-[11rem] [&_td:nth-child(n+4)]:min-w-[11rem] [&_td:nth-child(n+4)]:max-w-[11rem]';

/** Sama seperti markdown, tetapi kolom terakhir = Action (tombol revisi/hapus). */
const COL_WIDTHS_WITH_ACTION =
  '[&_th:nth-child(1)]:w-[5.5rem] [&_th:nth-child(1)]:min-w-[5.5rem] [&_th:nth-child(1)]:max-w-[5.5rem] ' +
  '[&_td:nth-child(1)]:w-[5.5rem] [&_td:nth-child(1)]:min-w-[5.5rem] [&_td:nth-child(1)]:max-w-[5.5rem] ' +
  '[&_th:nth-child(2)]:w-[16rem] [&_th:nth-child(2)]:min-w-[16rem] [&_th:nth-child(2)]:max-w-[16rem] ' +
  '[&_td:nth-child(2)]:w-[16rem] [&_td:nth-child(2)]:min-w-[16rem] [&_td:nth-child(2)]:max-w-[16rem] ' +
  '[&_th:nth-child(3)]:w-[15rem] [&_th:nth-child(3)]:min-w-[15rem] [&_th:nth-child(3)]:max-w-[15rem] ' +
  '[&_td:nth-child(3)]:w-[15rem] [&_td:nth-child(3)]:min-w-[15rem] [&_td:nth-child(3)]:max-w-[15rem] ' +
  '[&_th:nth-child(n+4):not(:last-child)]:w-[11rem] [&_th:nth-child(n+4):not(:last-child)]:min-w-[11rem] ' +
  '[&_td:nth-child(n+4):not(:last-child)]:w-[11rem] [&_td:nth-child(n+4):not(:last-child)]:min-w-[11rem] ' +
  '[&_th:nth-last-child(2)]:w-[100%] [&_td:nth-last-child(2)]:w-[100%] ' +
  '[&_th:last-child]:w-10 [&_th:last-child]:min-w-10 [&_th:last-child]:max-w-10 ' +
  '[&_td:last-child]:w-10 [&_td:last-child]:min-w-10 [&_td:last-child]:max-w-10';

export function scriptBreakdownMarkdownTableClassName() {
  return cn(TABLE_BASE, '!w-max', COL_WIDTHS_MARKDOWN);
}

export function scriptBreakdownRevisionTableClassName() {
  return cn(TABLE_BASE, '!w-full', COL_WIDTHS_WITH_ACTION);
}

/** Lebar minimum kolom data (tanpa Action), supaya tabel tetap bisa discroll horizontal. */
export function scriptBreakdownDataColumnsMinWidthRem(columnCount: number) {
  let width = 0;
  for (let i = 0; i < columnCount; i += 1) {
    if (i === 0) width += 5.5;
    else if (i === 1) width += 16;
    else if (i === 2) width += 15;
    else width += 11;
  }
  return width;
}

/** th/td umum: judul & isi membungkus dalam sel berlebar tetap. */
export const SCRIPT_BREAKDOWN_CELL_TH =
  'px-3 py-3 text-left font-semibold text-gray-800 whitespace-normal break-words border-b border-gray-200';
export const SCRIPT_BREAKDOWN_CELL_TD =
  'px-3 py-3 text-gray-700 align-top whitespace-normal break-words';
