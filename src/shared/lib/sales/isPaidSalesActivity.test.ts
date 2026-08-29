import { describe, expect, it } from 'vitest';
import { isPaidSalesActivity } from './isPaidSalesActivity';

describe('isPaidSalesActivity', () => {
  it('returns true when payment_status is paid', () => {
    expect(isPaidSalesActivity({ total_amount: 1000, payment_status: 'paid' })).toBe(true);
  });

  it('returns true when is_paid and total_paid_amount >= total_amount', () => {
    expect(
      isPaidSalesActivity({
        total_amount: 36000,
        total_paid_amount: 36000,
        is_paid: true,
        payment_status: 'unpaid',
      }),
    ).toBe(true);
  });

  it('returns false for partial payment', () => {
    expect(
      isPaidSalesActivity({
        total_amount: 36000,
        total_paid_amount: 10000,
        is_paid: false,
        payment_status: 'partial',
      }),
    ).toBe(false);
  });

  it('returns false for zero or invalid total', () => {
    expect(isPaidSalesActivity({ total_amount: 0, payment_status: 'paid' })).toBe(false);
    expect(isPaidSalesActivity({ total_amount: null, payment_status: 'paid' })).toBe(false);
  });
});
