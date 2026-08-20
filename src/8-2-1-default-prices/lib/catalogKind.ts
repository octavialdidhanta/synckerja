export type CatalogKind = 'service' | 'product';

export const LEAD_CONVERSION_CATALOG_KIND: CatalogKind = 'service';

export const CATALOG_PRODUCT_UNITS = ['pcs', 'porsi', 'cup', 'box', 'pack', 'botol'] as const;
export type CatalogProductUnit = (typeof CATALOG_PRODUCT_UNITS)[number];

export const CATALOG_PRODUCT_UNIT_CUSTOM = '__custom__';
export const CATALOG_PRODUCT_UNIT_MAX_LEN = 20;

export type CatalogPosStatus = 'available' | 'sold_out' | 'hidden';

export const CATALOG_POS_STATUSES: CatalogPosStatus[] = ['available', 'sold_out', 'hidden'];

export function isCatalogKind(value: string | null | undefined): value is CatalogKind {
  return value === 'service' || value === 'product';
}

export function isCatalogPosStatus(value: string | null | undefined): value is CatalogPosStatus {
  return value === 'available' || value === 'sold_out' || value === 'hidden';
}

export function normalizeCatalogPosStatus(value: string | null | undefined): CatalogPosStatus {
  return isCatalogPosStatus(value) ? value : 'available';
}

export function isCatalogProductUnitPreset(value: string | null | undefined): value is CatalogProductUnit {
  return (CATALOG_PRODUCT_UNITS as readonly string[]).includes(String(value ?? ''));
}

export function normalizeProductUnit(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim().slice(0, CATALOG_PRODUCT_UNIT_MAX_LEN);
  return trimmed || 'pcs';
}

export function isTrackedProduct(args: {
  kind?: string | null;
  trackStock?: boolean | null;
  inventorySkuId?: string | null;
}): boolean {
  return args.kind === 'product' && args.trackStock === true;
}

export function isCatalogProductHidden(status: string | null | undefined): boolean {
  return normalizeCatalogPosStatus(status) === 'hidden';
}

export function isCatalogProductSoldOut(args: {
  kind?: string | null;
  posStatus?: string | null;
  trackStock?: boolean | null;
  inventorySkuId?: string | null;
  availableQty?: number | null;
}): boolean {
  if (args.kind !== 'product') return false;
  if (normalizeCatalogPosStatus(args.posStatus) === 'sold_out') return true;
  return args.trackStock === true && Number(args.availableQty) <= 0;
}

export function assertProductCatalogPayload(args: {
  name: string;
  photoPath: string | null | undefined;
  trackStock: boolean;
  inventorySkuId: string | null | undefined;
}): string | null {
  if (!args.name.trim()) return 'product_name_required';
  if (!String(args.photoPath ?? '').trim()) return 'product_photo_required';
  return null;
}
