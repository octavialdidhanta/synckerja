import { describe, expect, it } from 'vitest';
import { averageOrderValue, lineTotal, sumCustomerVisitCart } from './sumCustomerVisitCart';
import type { CustomerVisitCartLine } from './customerVisitCheckout.types';

function line(partial: Partial<CustomerVisitCartLine> & Pick<CustomerVisitCartLine, 'quantity' | 'unitPrice'>): CustomerVisitCartLine {
  return {
    catalogId: 'c1',
    kind: 'service',
    serviceId: 's1',
    subServiceId: null,
    serviceName: 'Item',
    subServiceName: null,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...partial,
  };
}

describe('sumCustomerVisitCart', () => {
  it('sums qty × price and item counts', () => {
    expect(
      sumCustomerVisitCart([
        line({ quantity: 2, unitPrice: 15_000 }),
        line({ quantity: 1, unitPrice: 10_000 }),
      ]),
    ).toEqual({ lineCount: 2, itemCount: 3, total: 40_000 });
  });

  it('skips invalid qty or price', () => {
    expect(lineTotal({ quantity: 0, unitPrice: 10_000 })).toBe(0);
    expect(lineTotal({ quantity: 1, unitPrice: -1 })).toBe(0);
    expect(sumCustomerVisitCart([line({ quantity: 0, unitPrice: 10_000 })])).toEqual({
      lineCount: 0,
      itemCount: 0,
      total: 0,
    });
  });
});

describe('averageOrderValue', () => {
  it('is revenue / ticket count, rounded', () => {
    expect(averageOrderValue([40_000, 20_000])).toBe(30_000);
    expect(averageOrderValue([])).toBe(0);
    expect(averageOrderValue([0, -1])).toBe(0);
  });
});
