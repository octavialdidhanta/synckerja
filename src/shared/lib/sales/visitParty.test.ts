import { describe, expect, it } from 'vitest';
import { encodeVisitPartyKey, parseVisitPartyKey } from './visitParty';

describe('visitParty', () => {
  it('encodes and parses lead/client keys', () => {
    const leadId = 'c1c1c1c1-1111-4111-8111-111111111101';
    const clientId = 'd2d2d2d2-2222-4222-8222-222222222202';
    expect(parseVisitPartyKey(encodeVisitPartyKey('lead', leadId))).toEqual({
      kind: 'lead',
      id: leadId,
    });
    expect(parseVisitPartyKey(encodeVisitPartyKey('client', clientId))).toEqual({
      kind: 'client',
      id: clientId,
    });
  });

  it('returns null for empty or unknown values', () => {
    expect(parseVisitPartyKey('')).toBeNull();
    expect(parseVisitPartyKey('c1c1c1c1-1111-4111-8111-111111111101')).toBeNull();
    expect(parseVisitPartyKey('lead:not-a-uuid')).toBeNull();
  });
});
