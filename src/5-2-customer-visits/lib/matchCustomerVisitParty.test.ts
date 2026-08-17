import { describe, expect, it } from 'vitest';
import { matchCustomerVisitParty, type CustomerVisitLeadCandidate } from './matchCustomerVisitParty';
import { normalizeCustomerVisitIgHandle } from './normalizeCustomerVisitIgHandle';
import { normalizeCustomerVisitPhone } from './normalizeCustomerVisitPhone';

const leadA: CustomerVisitLeadCandidate = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  client: 'Andi Store',
  phone_number: '081234567890',
  ticket_id: 'LEAD-A',
  source: 'Lead Magnet',
};

const leadB: CustomerVisitLeadCandidate = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  client: 'fiqri_fox',
  phone_number: '+62 812-1111-2222',
  ticket_id: 'LEAD-B',
  source: 'Lead Magnet',
};

const leadC: CustomerVisitLeadCandidate = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  client: 'Same Phone',
  phone_number: '6281234567890',
  ticket_id: 'LEAD-C',
  source: 'Website',
};

describe('normalizeCustomerVisitPhone', () => {
  it('normalizes 08 / 62 / +62 to the same key', () => {
    expect(normalizeCustomerVisitPhone('081234567890')).toBe('6281234567890');
    expect(normalizeCustomerVisitPhone('6281234567890')).toBe('6281234567890');
    expect(normalizeCustomerVisitPhone('+62 812-3456-7890')).toBe('6281234567890');
  });
});

describe('normalizeCustomerVisitIgHandle', () => {
  it('strips @ and lowercases a valid handle', () => {
    expect(normalizeCustomerVisitIgHandle('@Fiqri_Fox')).toBe('fiqri_fox');
  });

  it('rejects display names and numeric ids', () => {
    expect(normalizeCustomerVisitIgHandle('Andi Store')).toBeNull();
    expect(normalizeCustomerVisitIgHandle('178414000')).toBeNull();
  });
});

describe('matchCustomerVisitParty', () => {
  it('matches phone exactly after normalize, including two people with the same number', () => {
    const none = matchCustomerVisitParty({
      kind: 'phone',
      normalized: '629999999999',
      leads: [leadA, leadB],
    });
    expect(none.status).toBe('none');

    const unique = matchCustomerVisitParty({
      kind: 'phone',
      normalized: '6281211112222',
      leads: [leadA, leadB],
    });
    expect(unique).toEqual({ status: 'unique', lead: leadB });

    const many = matchCustomerVisitParty({
      kind: 'phone',
      normalized: '6281234567890',
      leads: [leadA, leadB, leadC],
    });
    expect(many.status).toBe('many');
    if (many.status === 'many') {
      expect(many.leads.map((l) => l.id).sort()).toEqual([leadA.id, leadC.id].sort());
    }
  });

  it('matches IG via lead name and enrollment username', () => {
    const uniqueName = matchCustomerVisitParty({
      kind: 'instagram',
      normalized: 'fiqri_fox',
      leads: [leadA, leadB],
      enrollments: [],
    });
    expect(uniqueName).toEqual({ status: 'unique', lead: leadB });

    const uniqueEnroll = matchCustomerVisitParty({
      kind: 'instagram',
      normalized: 'andi_ig',
      leads: [leadA, leadB],
      enrollments: [{ lead_id: leadA.id, participant_username: '@Andi_Ig' }],
    });
    expect(uniqueEnroll).toEqual({ status: 'unique', lead: leadA });
  });

  it('does not substring-match IG', () => {
    const result = matchCustomerVisitParty({
      kind: 'instagram',
      normalized: 'fox',
      leads: [leadB],
      enrollments: [{ lead_id: leadB.id, participant_username: 'fiqri_fox' }],
    });
    expect(result.status).toBe('none');
  });

  it('prefers the Lead Magnet row when IG inbox and campaign leads both match', () => {
    const igInbox: CustomerVisitLeadCandidate = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      client: '@vialdi.id',
      phone_number: null,
      ticket_id: 'IG-0FF6AA1F',
      source: 'Instagram',
    };
    const campaign: CustomerVisitLeadCandidate = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      client: 'vialdi.id',
      phone_number: null,
      ticket_id: 'LEAD-10F9E361',
      source: 'Lead Magnet',
    };
    const result = matchCustomerVisitParty({
      kind: 'instagram',
      normalized: 'vialdi.id',
      leads: [igInbox, campaign],
      enrollments: [{ lead_id: campaign.id, participant_username: 'vialdi.id' }],
    });
    expect(result).toEqual({ status: 'unique', lead: campaign });
  });
});
