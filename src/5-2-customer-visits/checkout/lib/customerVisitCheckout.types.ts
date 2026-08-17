export type CustomerVisitCheckoutPaymentMethod = 'cash' | 'bank_transfer' | 'e_wallet';

export type CustomerVisitCatalogKind = 'service' | 'product';

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
};

export type CustomerVisitCartLine = {
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
};

export type CustomerVisitCartTotals = {
  lineCount: number;
  itemCount: number;
  total: number;
};
