import { describe, expect, it } from 'vitest';
import {
  assertProductCatalogPayload,
  isCatalogProductHidden,
  isCatalogProductSoldOut,
  isTrackedProduct,
  LEAD_CONVERSION_CATALOG_KIND,
  normalizeProductUnit,
} from './catalogKind';

describe('isTrackedProduct', () => {
  it('is true for product + track_stock', () => {
    expect(isTrackedProduct({ kind: 'product', trackStock: true, inventorySkuId: null })).toBe(true);
    expect(isTrackedProduct({ kind: 'product', trackStock: false, inventorySkuId: 'sku-1' })).toBe(false);
    expect(isTrackedProduct({ kind: 'service', trackStock: true, inventorySkuId: 'sku-1' })).toBe(false);
  });
});

describe('LEAD_CONVERSION_CATALOG_KIND', () => {
  it('Live Chat Converted looks up services only', () => {
    expect(LEAD_CONVERSION_CATALOG_KIND).toBe('service');
  });
});

describe('assertProductCatalogPayload', () => {
  it('requires name and photo', () => {
    expect(assertProductCatalogPayload({ name: '', photoPath: 'p.jpg', trackStock: false, inventorySkuId: null })).toBe(
      'product_name_required',
    );
    expect(assertProductCatalogPayload({ name: 'Kopi', photoPath: '', trackStock: false, inventorySkuId: null })).toBe(
      'product_photo_required',
    );
    expect(
      assertProductCatalogPayload({ name: 'Botol', photoPath: 'p.jpg', trackStock: true, inventorySkuId: null }),
    ).toBeNull();
    expect(
      assertProductCatalogPayload({
        name: 'Menu',
        photoPath: 'p.jpg',
        trackStock: false,
        inventorySkuId: null,
      }),
    ).toBeNull();
  });
});

describe('POS catalog visibility', () => {
  it('hides hidden products from POS', () => {
    expect(isCatalogProductHidden('hidden')).toBe(true);
    expect(isCatalogProductHidden('available')).toBe(false);
    expect(isCatalogProductHidden('sold_out')).toBe(false);
  });

  it('treats sold_out status or tracked qty 0 as sold out', () => {
    expect(isCatalogProductSoldOut({ kind: 'product', posStatus: 'sold_out' })).toBe(true);
    expect(
      isCatalogProductSoldOut({
        kind: 'product',
        posStatus: 'available',
        trackStock: true,
        inventorySkuId: null,
        availableQty: 0,
      }),
    ).toBe(true);
    expect(
      isCatalogProductSoldOut({
        kind: 'product',
        posStatus: 'available',
        trackStock: false,
        inventorySkuId: null,
        availableQty: 0,
      }),
    ).toBe(false);
  });

  it('normalizes blank custom units to pcs', () => {
    expect(normalizeProductUnit('  pack  ')).toBe('pack');
    expect(normalizeProductUnit('')).toBe('pcs');
  });
});
