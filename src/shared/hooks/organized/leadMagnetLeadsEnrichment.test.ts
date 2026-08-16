import { describe, expect, it } from 'vitest';
import {
  applyLeadMagnetAssigneeOverlay,
  buildLeadMagnetLinkedConversationIdSet,
  buildLeadMagnetLinkedTicketSuffixSet,
  buildLeadMagnetParticipantScopedIdSet,
  buildLeadMagnetVirtualDedupeContext,
  conversationUuidToTicketSuffix,
  isLeadMagnetSourceLead,
  parseVirtualChannelTicketSuffix,
  resolveLeadMagnetConversationSyncTarget,
  resolveLeadMagnetConversationSyncTargetFromMeta,
  shouldHideVirtualConversationForLeadMagnet,
} from './leadMagnetLeadsEnrichment';
import type { LeadMagnetLeadMeta } from './leadMagnetLeadsEnrichment';

const sampleMeta = (): LeadMagnetLeadMeta => ({
  _fromLeadMagnet: true,
  _leadMagnetEnrollmentId: 'e1',
  _leadMagnetConversationId: '414717fe-3157-46e5-b58d-72164a3139f0',
  _leadMagnetConversationTable: 'instagram_conversations',
  _leadMagnetEnrollmentStatus: 'delivered',
  _leadMagnetCampaignId: 'c1',
  _leadMagnetCampaignName: 'Test',
  _leadMagnetKeyword: 'mantab',
  _leadMagnetPlatform: 'instagram',
  _leadMagnetParticipantScopedId: '7813056332046745',
  _leadMagnetMediaCaption: null,
  _leadMagnetMediaPermalink: null,
});

describe('leadMagnetLeadsEnrichment', () => {
  it('detects Lead Magnet source leads', () => {
    expect(isLeadMagnetSourceLead({ source: 'Lead Magnet' })).toBe(true);
    expect(isLeadMagnetSourceLead({ category: 'Lead Magnet' })).toBe(true);
    expect(isLeadMagnetSourceLead({ source: 'Website form' })).toBe(false);
  });

  it('builds linked conversation id set', () => {
    const map = new Map<string, LeadMagnetLeadMeta>([['a', sampleMeta()]]);
    const ids = buildLeadMagnetLinkedConversationIdSet(map);
    expect(ids.has('414717fe-3157-46e5-b58d-72164a3139f0')).toBe(true);
    expect(ids.has('conv-2')).toBe(false);
  });

  it('derives ticket suffix from conversation uuid', () => {
    expect(conversationUuidToTicketSuffix('414717fe-3157-46e5-b58d-72164a3139f0')).toBe('414717FE');
    expect(parseVirtualChannelTicketSuffix('IG-414717FE')).toBe('414717FE');
    expect(parseVirtualChannelTicketSuffix('FB-13231239')).toBe('13231239');
  });

  it('builds ticket suffix and participant dedupe sets', () => {
    const map = new Map<string, LeadMagnetLeadMeta>([['a', sampleMeta()]]);
    expect(buildLeadMagnetLinkedTicketSuffixSet(map).has('414717FE')).toBe(true);
    expect(buildLeadMagnetParticipantScopedIdSet(map).has('7813056332046745')).toBe(true);
  });

  it('hides virtual rows by conversation id', () => {
    const ctx = buildLeadMagnetVirtualDedupeContext(
      new Map<string, LeadMagnetLeadMeta>([['a', sampleMeta()]]),
    );
    expect(
      shouldHideVirtualConversationForLeadMagnet(
        { conversationId: '414717fe-3157-46e5-b58d-72164a3139f0' },
        ctx,
      ),
    ).toBe(true);
    expect(
      shouldHideVirtualConversationForLeadMagnet({ conversationId: 'other-id' }, ctx),
    ).toBe(false);
  });

  it('hides virtual IG row by ticket suffix when conversation id differs in casing', () => {
    const ctx = buildLeadMagnetVirtualDedupeContext(
      new Map<string, LeadMagnetLeadMeta>([['a', sampleMeta()]]),
    );
    expect(
      shouldHideVirtualConversationForLeadMagnet(
        {
          conversationId: '414717fe-3157-46e5-b58d-72164a3139f0',
          ticketId: 'IG-414717FE',
        },
        ctx,
      ),
    ).toBe(true);
  });

  it('hides virtual row by participant scoped id fallback', () => {
    const ctx = buildLeadMagnetVirtualDedupeContext(
      new Map<string, LeadMagnetLeadMeta>([['a', sampleMeta()]]),
    );
    expect(
      shouldHideVirtualConversationForLeadMagnet(
        {
          conversationId: 'unknown-conv',
          customerIgId: '7813056332046745',
        },
        ctx,
      ),
    ).toBe(true);
  });

  it('supports legacy Set-only signature for conversation id', () => {
    const linked = new Set(['abc']);
    expect(shouldHideVirtualConversationForLeadMagnet('abc', linked)).toBe(true);
    expect(shouldHideVirtualConversationForLeadMagnet('other', linked)).toBe(false);
  });
});
