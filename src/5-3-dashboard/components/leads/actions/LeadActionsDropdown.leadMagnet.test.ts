import { describe, expect, it } from 'vitest';
import { buildLivechatUrl } from '@/5-3-dashboard/components/leads/actions/LeadActionsDropdown';

describe('LeadActionsDropdown buildLivechatUrl', () => {
  it('opens live chat from Lead Magnet conversation id', () => {
    const url = buildLivechatUrl({
      id: '478ea52f-3fff-4748-8108-ca57407461d6',
      ticket_id: 'LEAD-478EA52F',
      _fromLeadMagnet: true,
      _leadMagnetConversationId: '414717fe-3157-46e5-b58d-72164a3139f0',
    } as Parameters<typeof buildLivechatUrl>[0]);

    expect(url).toBe(
      '/omnichannel/livechat?conversation=414717fe-3157-46e5-b58d-72164a3139f0',
    );
  });

  it('falls back to ig- virtual row conversation id', () => {
    const url = buildLivechatUrl({
      id: 'ig-414717fe-3157-46e5-b58d-72164a3139f0',
      ticket_id: 'IG-414717FE',
      _fromInstagram: true,
    } as Parameters<typeof buildLivechatUrl>[0]);

    expect(url).toBe(
      '/omnichannel/livechat?conversation=414717fe-3157-46e5-b58d-72164a3139f0',
    );
  });
});
