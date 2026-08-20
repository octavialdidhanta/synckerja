import { describe, expect, it } from 'vitest';
import {
  catalogCheckoutSaleLines,
  findInsufficientStoreCheckoutStock,
  isDuplicateOfflineSale,
  offlineSalePayloads,
  trackedStoreCheckoutLines,
} from './storeCheckoutStock';

const tracked = {
  kind: 'product' as const,
  trackStock: true,
  inventorySkuId: 'sku-1',
  quantity: 2,
  availableQty: 5,
  label: 'Botol',
};

describe('trackedStoreCheckoutLines', () => {
  it('keeps tracked product qty only', () => {
    expect(
      trackedStoreCheckoutLines([
        tracked,
        { kind: 'product', trackStock: false, inventorySkuId: null, quantity: 3 },
        { kind: 'service', trackStock: false, inventorySkuId: null, quantity: 1 },
      ]),
    ).toEqual([tracked]);
  });

  it('keeps tracked products without an inventory SKU', () => {
    const catalogOnly = {
      kind: 'product' as const,
      trackStock: true,
      inventorySkuId: null,
      quantity: 1,
      catalogId: 'p9',
    };
    expect(trackedStoreCheckoutLines([catalogOnly])).toEqual([catalogOnly]);
  });
});

describe('findInsufficientStoreCheckoutStock', () => {
  it('blocks when qty exceeds available', () => {
    expect(findInsufficientStoreCheckoutStock([{ ...tracked, quantity: 6, availableQty: 5 }])).toEqual({
      ...tracked,
      quantity: 6,
      availableQty: 5,
    });
    expect(findInsufficientStoreCheckoutStock([tracked])).toBeNull();
  });

  it('ignores untracked menu items', () => {
    expect(
      findInsufficientStoreCheckoutStock([
        { kind: 'product', trackStock: false, inventorySkuId: null, quantity: 99, availableQty: 0 },
      ]),
    ).toBeNull();
  });
});

describe('isDuplicateOfflineSale', () => {
  it('is idempotent per activity id', () => {
    expect(isDuplicateOfflineSale({ existingReferenceIds: ['act-1'], activityId: 'act-1' })).toBe(true);
    expect(isDuplicateOfflineSale({ existingReferenceIds: ['act-1'], activityId: 'act-2' })).toBe(false);
  });
});

describe('catalogCheckoutSaleLines', () => {
  it('maps tracked catalog products even without a SKU', () => {
    expect(
      catalogCheckoutSaleLines([
        { ...tracked, catalogId: 'p1' },
        { kind: 'product', trackStock: true, inventorySkuId: null, quantity: 3, catalogId: 'p2' },
        { kind: 'product', trackStock: false, inventorySkuId: null, quantity: 3, catalogId: 'p3' },
      ]),
    ).toEqual([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', qty: 3 },
    ]);
  });
});

describe('offlineSalePayloads', () => {
  it('maps tracked lines to store_checkout references', () => {
    expect(
      offlineSalePayloads('act-9', [
        tracked,
        { kind: 'product', trackStock: false, inventorySkuId: null, quantity: 3 },
      ]),
    ).toEqual([
      {
        skuId: 'sku-1',
        qty: 2,
        referenceType: 'store_checkout',
        referenceId: 'act-9',
      },
    ]);
  });
});
