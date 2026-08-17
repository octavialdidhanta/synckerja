import { describe, expect, it } from 'vitest';
import {
  buildClientVisitSalesActivityInsertPayload,
  normalizeSalesActivityStatusForDb,
  resolveSalesActivityPaymentMethod,
} from './buildClientVisitSalesActivityPayload';

describe('buildClientVisitSalesActivityPayload', () => {
  it('maps completed status and null payment when unpaid', () => {
    const payload = buildClientVisitSalesActivityInsertPayload(
      {
        client_name: ' ACME ',
        activity_type: 'visit',
        status: 'completed',
        is_paid: false,
        payment_method: '',
      },
      'org-1',
      'user-1',
    );

    expect(payload.status).toBe('Won');
    expect(payload.payment_method).toBeNull();
    expect(payload.client_name).toBe('ACME');
  });

  it('normalizes payment method when paid', () => {
    expect(resolveSalesActivityPaymentMethod(true, 'debit_card')).toBe('other');
    expect(resolveSalesActivityPaymentMethod(true, 'transfer')).toBe('bank_transfer');
    expect(resolveSalesActivityPaymentMethod(false, 'cash')).toBeNull();
    expect(normalizeSalesActivityStatusForDb('in_progress')).toBe('Active');
  });
});
