import { describe, expect, it } from 'vitest';
import { buildLeadMagnetFunnelView } from './buildLeadMagnetFunnelView';

describe('buildLeadMagnetFunnelView', () => {
  it('builds main path with conversion % and merges deliveries', () => {
    const view = buildLeadMagnetFunnelView({
      comment_matched: 10,
      comment_replied: 8,
      framework_offered: 5,
      follow_gate_sent: 2,
      follow_validated: 4,
      contact_collected: 3,
      delivery_instagram_sent: 2,
      delivery_whatsapp_sent: 1,
      dm_failed: 1,
      contact_invalid: 2,
    });

    expect(view.topCount).toBe(10);
    expect(view.steps.map((s) => s.id)).toEqual([
      'comment_matched',
      'comment_replied',
      'opening_or_follow_gate',
      'follow_validated',
      'contact_collected',
      'delivered',
    ]);
    expect(view.steps[0]!.count).toBe(10);
    expect(view.steps[1]!.pctFromPrev).toBe(80);
    expect(view.steps[2]!.count).toBe(5); // framework_offered only (no material_offer_skipped)
    expect(view.steps[3]!.count).toBe(4);
    expect(view.steps[5]!.count).toBe(3); // 2+1 deliveries
    expect(view.sideStats.map((s) => s.id)).toEqual([
      'follow_gate_sent',
      'contact_invalid',
      'dm_failed',
    ]);
  });

  it('sums opening-first and skip-opening without double-counting follow_gate', () => {
    const view = buildLeadMagnetFunnelView({
      comment_matched: 10,
      framework_offered: 6,
      material_offer_skipped: 3,
      follow_gate_sent: 8,
    });
    expect(view.steps.find((s) => s.id === 'opening_or_follow_gate')!.count).toBe(9);
  });

  it('returns empty top when no events', () => {
    const view = buildLeadMagnetFunnelView({});
    expect(view.topCount).toBe(0);
    expect(view.steps.every((s) => s.count === 0)).toBe(true);
  });
});
