import { isCatalogProductSoldOut } from '@/8-2-1-default-prices/lib/catalogKind';
import type { CustomerVisitCatalogItem } from './customerVisitCheckout.types';

export function formatStoreCheckoutRp(value: number): string {
  return `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

export function catalogItemLabel(item: Pick<CustomerVisitCatalogItem, 'serviceName' | 'subServiceName'>): string {
  const service = item.serviceName.trim() || '—';
  const sub = item.subServiceName?.trim();
  return sub ? `${service} · ${sub}` : service;
}

export function isCatalogItemOutOfStock(
  item: Pick<
    CustomerVisitCatalogItem,
    'kind' | 'trackStock' | 'inventorySkuId' | 'availableQty' | 'posStatus'
  >,
): boolean {
  return isCatalogProductSoldOut({
    kind: item.kind,
    posStatus: item.posStatus,
    trackStock: item.trackStock,
    inventorySkuId: item.inventorySkuId,
    availableQty: item.availableQty,
  });
}
