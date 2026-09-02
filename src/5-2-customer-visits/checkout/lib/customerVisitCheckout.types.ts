export type CustomerVisitCheckoutPaymentMethod = 'cash' | 'bank_transfer' | 'e_wallet' | 'qris';

export type CustomerVisitCatalogKind = 'service' | 'product' | 'bundle';

export type CustomerVisitCartModifier = {
  optionId: string;
  name: string;
  extraPrice: number;
  quantity?: number;
};

export type CustomerVisitCartLineDiscount = {
  id: string;
  name: string;
  amountRp: number;
};

export type CustomerVisitCatalogItem = {
  id: string;
  kind: CustomerVisitCatalogKind;
  serviceId: string | null;
  subServiceId: string | null;
  serviceName: string;
  subServiceName: string | null;
  unitPrice: number;
  photoUrl: string | null;
  unit: string | null;
  trackStock: boolean;
  inventorySkuId: string | null;
  availableQty: number | null;
  productCategoryId: string | null;
  productCategoryName: string | null;
  posStatus: 'available' | 'sold_out' | 'hidden';
  /** Gate for POS customize popup (products only). */
  variantCount?: number;
  hasModifiers?: boolean;
  useSalesTypePrices?: boolean;
  hasSalesTypePrices?: boolean;
};

export type CustomerVisitCartLine = {
  /** Stable identity for merge / qty updates (plain = catalogId; customized = fingerprint). */
  lineKey: string;
  catalogId: string;
  kind: CustomerVisitCatalogKind;
  serviceId: string | null;
  subServiceId: string | null;
  serviceName: string;
  subServiceName: string | null;
  quantity: number;
  unitPrice: number;
  photoUrl?: string | null;
  unit?: string | null;
  trackStock: boolean;
  inventorySkuId: string | null;
  availableQty: number | null;
  productCategoryId?: string | null;
  productCategoryName?: string | null;
  /** POS Custom tab open amount — Cash In on pay, not a catalog sale. */
  isCustomAmount?: boolean;
  variantId?: string | null;
  variantName?: string | null;
  modifiers?: CustomerVisitCartModifier[];
  lineDiscount?: CustomerVisitCartLineDiscount | null;
  lineSalesTypeId?: string | null;
  lineSalesTypeLabel?: string | null;
  kitchenNote?: string | null;
};

export type CustomerVisitCartTotals = {
  lineCount: number;
  itemCount: number;
  total: number;
};
