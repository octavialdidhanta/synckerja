import { describe, expect, it } from 'vitest';
import {
  buildLeadMagnetLinkedConversationIdSet,
  isLeadMagnetSourceLead,
  shouldHideVirtualConversationForLeadMagnet,
} from './leadMagnetLeadsEnrichment';
import type { LeadMagnetLeadMeta } from './leadMagnetLeadsEnrichment';

describe('leadMagnetLeadsEnrichment', () => {
  it('detects Lead Magnet source leads', () => {
    expect(isLeadMagnetSourceLead({ source: 'Lead Magnet' })).toBe(true);
    expect(isLeadMagnetSourceLead({ category: 'Lead Magnet' })).toBe(true);
    expect(isLeadMagnetSourceLead({ source: 'Website form' })).toBe(false);
  });

  it('builds linked conversation id set', () => {
    const map = new Map<string, LeadMagnetLeadMeta>([
      ['a', {
        _fromLeadMagnet: true,
        _leadMagnetEnrollmentId: 'e1',
        _leadMagnetConversationId: 'conv-1',
        _leadMagnetConversationTable: 'instagram_conversations',
        _leadMagnetEnrollmentStatus: 'follow_gate_sent',
        _leadMagnetCampaignId: 'c1',
        _leadMagnetCampaignName: 'Test',
        _leadMagnetKeyword: 'mantab',
        _leadMagnetPlatform: 'instagram',
      }],
    ]);
    const ids = buildLeadMagnetLinkedConversationIdSet(map);
    expect(ids.has('conv-1')).toBe(true);
    expect(ids.has('conv-2')).toBe(false);
  });

  it('hides virtual rows when conversation is linked to Lead Magnet lead', () => {
    const linked = new Set(['abc']);
    expect(shouldHideVirtualConversationForLeadMagnet('abc', linked)).toBe(true);
    expect(shouldHideVirtualConversationForLeadMagnet('other', linked)).toBe(false);
  });
});
