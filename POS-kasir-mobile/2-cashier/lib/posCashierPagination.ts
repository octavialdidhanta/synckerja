export const POS_CASHIER_GRID_COLUMNS = 4;
/** Phone Favorit/Library: max 3 thumbnails per row (4 is too small). */
export const POS_CASHIER_PHONE_GRID_COLUMNS = 3;
export const POS_CASHIER_GRID_ROWS = 5;
export const POS_CASHIER_PAGE_SIZE = POS_CASHIER_GRID_COLUMNS * POS_CASHIER_GRID_ROWS;
export const POS_CASHIER_PHONE_PAGE_SIZE =
  POS_CASHIER_PHONE_GRID_COLUMNS * POS_CASHIER_GRID_ROWS;

export function posCashierPageSize(isPhoneLayout: boolean): number {
  return isPhoneLayout ? POS_CASHIER_PHONE_PAGE_SIZE : POS_CASHIER_PAGE_SIZE;
}

export function paginateItems<T>(items: T[], pageIndex: number, pageSize = POS_CASHIER_PAGE_SIZE): T[] {
  const start = Math.max(0, pageIndex) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCount(totalItems: number, pageSize = POS_CASHIER_PAGE_SIZE): number {
  if (totalItems <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
