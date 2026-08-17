import { describe, expect, it } from 'vitest';
import {
  activityTypeSearchText,
  collectActivityTypesFromActivities,
  formatActivityTypeLabel,
  getActivityTypeColor,
  isCreatableSalesActivityType,
  isStoreCheckoutActivityType,
  mergeActivityTypeGroups,
  STORE_CHECKOUT_ACTIVITY_TYPE,
} from './salesActivityType';

describe('salesActivityType', () => {
  it('identifies Store Checkout and keeps it out of New Activity', () => {
    expect(isStoreCheckoutActivityType('Store Checkout')).toBe(true);
    expect(isStoreCheckoutActivityType('store checkout')).toBe(true);
    expect(isCreatableSalesActivityType(STORE_CHECKOUT_ACTIVITY_TYPE)).toBe(false);
    expect(isCreatableSalesActivityType('Demo')).toBe(true);
  });

  it('merges canonical groups with extra types from data', () => {
    const groups = mergeActivityTypeGroups(['Store Checkout', 'Demo', 'Custom Follow-up', 'visit']);
    expect(groups.store).toEqual([STORE_CHECKOUT_ACTIVITY_TYPE]);
    expect(groups.sales).toContain('Demo');
    expect(groups.sales).toContain('Lead Conversion');
    expect(groups.sales).toContain('visit');
    expect(groups.sales).toContain('Custom Follow-up');
    expect(groups.sales.filter((type) => type.toLowerCase() === 'demo')).toHaveLength(1);
  });

  it('collects unique types from unfiltered activities', () => {
    expect(
      collectActivityTypesFromActivities([
        { activity_type: 'Demo' },
        { activity_type: 'demo' },
        { activity_type: 'Store Checkout' },
        { activity_type: '' },
      ]),
    ).toEqual(['Demo', 'Store Checkout']);
  });

  it('labels Store Checkout distinctly from Lead Conversion', () => {
    expect(formatActivityTypeLabel('Store Checkout')).toBe('Store checkout');
    expect(formatActivityTypeLabel('Lead Conversion')).toBe('Lead Conversion');
    expect(formatActivityTypeLabel('visit')).toBe('Visit');
    expect(
      formatActivityTypeLabel('Store Checkout', (key, fallback) =>
        key === 'salesActivities.type.storeCheckout' ? 'Kasir toko' : fallback,
      ),
    ).toBe('Kasir toko');
  });

  it('uses a different badge color for Store Checkout than Lead Conversion', () => {
    const store = getActivityTypeColor('Store Checkout');
    const lead = getActivityTypeColor('Lead Conversion');
    expect(store).toContain('teal');
    expect(lead).toContain('gray');
    expect(store).not.toBe(lead);
  });

  it('search text matches store / kasir aliases', () => {
    const haystack = activityTypeSearchText('Store Checkout');
    expect(haystack).toContain('store');
    expect(haystack).toContain('kasir');
  });
});
