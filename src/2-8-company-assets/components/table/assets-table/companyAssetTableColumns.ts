/** Lebar minimum kolom tabel company assets — hindari header/konten terjepit. */
export const COMPANY_ASSET_TABLE_COLUMN_CLASS = {
  asset: 'min-w-[200px] w-[200px] px-3',
  type: 'min-w-[112px] w-[112px] px-3',
  serialNumber: 'min-w-[140px] w-[140px] px-3',
  brandModel: 'min-w-[160px] w-[160px] px-3',
  status: 'min-w-[120px] w-[120px] px-3',
  heldBy: 'min-w-[140px] w-[140px] px-3',
  holderDepartment: 'min-w-[168px] w-[168px] px-3',
  condition: 'min-w-[120px] w-[120px] px-3',
  requestedBy: 'min-w-[140px] w-[140px] px-3',
  department: 'min-w-[140px] w-[140px] px-3',
  receipt: 'min-w-[132px] w-[132px] px-3',
  purchasePrice: 'min-w-[140px] w-[140px] px-3 text-right tabular-nums',
  purchaseDate: 'min-w-[128px] w-[128px] px-3 whitespace-nowrap',
  actions: 'min-w-[80px] w-[80px] px-2 text-right',
} as const;

export const COMPANY_ASSET_TABLE_MIN_WIDTH = 'min-w-[1920px]';
