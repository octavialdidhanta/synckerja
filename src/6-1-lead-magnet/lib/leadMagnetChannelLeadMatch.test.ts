import { describe, expect, it } from 'vitest';
import {
  channelLeadTicketId,
  pickCanonicalLeadIdFromScopedEnrollments,
  pickCanonicalLeadIdFromUniqueHandle,
  resolveCanonicalLeadMagnetLeadId,
} from '../../../supabase/functions/_shared/leadMagnet/leadMagnetChannelLeadMatch.ts';

const lmA = {
  id: 'lead-magnet-a',
  client: 'vialdi.id',
  source: 'Lead Magnet',
  category: 'Lead Magnet',
};

const lmB = {
  id: 'lead-magnet-b',
  client: '@vialdi.id',
  source: 'Lead Magnet',
  category: 'Lead Magnet',
};

const igOnly = {
  id: 'ig-only',
  client: '@vialdi.id',
  source: 'Instagram',
  category: '',
};

describe('channelLeadTicketId', () => {
  it('uses first 8 hex chars of the conversation uuid', () => {
    expect(channelLeadTicketId('instagram', '0ff6aa1f-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe('IG-0FF6AA1F');
    expect(channelLeadTicketId('facebook', 'eab45f82-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe('FB-EAB45F82');
  });
});

describe('resolveCanonicalLeadMagnetLeadId', () => {
  it('prefers a unique enrollment lead_id for the IG scoped id', () => {
    expect(
      pickCanonicalLeadIdFromScopedEnrollments(
        ['7813056332046745'],
        [
          { lead_id: 'lead-magnet-a', participant_scoped_id: '7813056332046745' },
          { lead_id: 'lead-magnet-a', participant_scoped_id: '7813056332046745' },
        ],
      ),
    ).toBe('lead-magnet-a');
  });

  it('does not merge when two different lead_ids share the scoped id', () => {
    expect(
      pickCanonicalLeadIdFromScopedEnrollments(
        ['7813056332046745'],
        [
          { lead_id: 'lead-magnet-a', participant_scoped_id: '7813056332046745' },
          { lead_id: 'other', participant_scoped_id: '7813056332046745' },
        ],
      ),
    ).toBeNull();
  });

  it('falls back to a unique Lead Magnet handle and ignores the IG-only row', () => {
    expect(
      pickCanonicalLeadIdFromUniqueHandle('@vialdi.id', [lmA, igOnly]),
    ).toBe('lead-magnet-a');
  });

  it('does not merge when two Lead Magnet leads share the handle', () => {
    expect(pickCanonicalLeadIdFromUniqueHandle('vialdi.id', [lmA, lmB])).toBeNull();
  });

  it('uses enrollment before handle', () => {
    expect(
      resolveCanonicalLeadMagnetLeadId({
        scopedIds: ['ig-user-1'],
        enrollments: [{ lead_id: 'from-enroll', participant_scoped_id: 'ig-user-1' }],
        profiles: [{ canonical_lead_id: 'from-profile', participant_scoped_id: 'ig-user-1' }],
        handle: 'vialdi.id',
        leadMagnetLeads: [lmA],
      }),
    ).toBe('from-enroll');
  });
});
