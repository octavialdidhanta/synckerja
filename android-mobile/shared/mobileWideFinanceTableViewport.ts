/**
 * Viewport tinggi tetap untuk tabel lebar horizontal di mobile (debt, income transaction, dll.).
 * Selaras `DebtTableSection`: ~thead + ~10 baris, lalu scroll dalam viewport.
 */
export const MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS =
  "h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0";
