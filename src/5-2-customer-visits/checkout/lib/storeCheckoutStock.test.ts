import { describe, expect, it } from 'vitest';
import {
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
