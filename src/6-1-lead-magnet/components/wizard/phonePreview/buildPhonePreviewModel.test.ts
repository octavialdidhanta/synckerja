import { describe, expect, it } from 'vitest';
import { DEFAULT_LEAD_MAGNET_FORM } from '../../../types/leadMagnet.types';
import { buildPhonePreviewModel } from './buildPhonePreviewModel';

describe('buildPhonePreviewModel', () => {
  it('builds post + comments from keyword and reply slot', () => {
    const model = buildPhonePreviewModel(
      {
        ...DEFAULT_LEAD_MAGNET_FORM,
        keyword: 'Mantab',
        comment_reply_enabled: true,
        comment_reply_texts: ['Cek DM ya', 'B', 'C'],
        posts: [{
          platform: 'instagram',
          media_id: '1',
          media_permalink: null,
          media_caption: 'Caption contoh',
          media_thumbnail_url: 'https://example.com/t.jpg',
        }],
      },
      { accountLabel: '@octa.vialdi', accountAvatarUrl: null },
    );

    expect(model.account.username).toBe('octa.vialdi');
    expect(model.post.thumbnailUrl).toBe('https://example.com/t.jpg');
    expect(model.comments.userComment).toBe('Mantab');
    expect(model.comments.accountReply).toBe('Cek DM ya');
  });

  it('omits opening and follow when toggles off; keeps delivery buttons', () => {
    const model = buildPhonePreviewModel(
      {
        ...DEFAULT_LEAD_MAGNET_FORM,
        skip_material_offer: true,
        skip_follow_gate_if_follower: true,
        email_collection_enabled: false,
        delivery_text: 'Hai {{username}}! link',
        delivery_links: [
          { label: 'Link A', url: 'https://a.com' },
          { label: 'Link B', url: 'https://b.com' },
        ],
      },
      { accountLabel: 'brand', accountAvatarUrl: null },
    );

    expect(model.dmMessages).toHaveLength(1);
    expect(model.dmMessages[0]).toMatchObject({
      kind: 'incoming',
      text: 'Hai Username! link',
      buttons: ['Link A', 'Link B'],
    });
  });

  it('includes opening tap, follow, email, then delivery when all on', () => {
    const model = buildPhonePreviewModel(
      {
        ...DEFAULT_LEAD_MAGNET_FORM,
        skip_material_offer: false,
        skip_follow_gate_if_follower: false,
        email_collection_enabled: true,
        framework_button_label: 'Kirim link',
        follow_button_label: 'Sudah Follow',
        delivery_links: [{ label: 'Unduh', url: 'https://x.com' }],
      },
      { accountLabel: 'brand', accountAvatarUrl: null },
    );

    const kinds = model.dmMessages.map((m) => m.kind);
    expect(kinds).toEqual([
      'incoming',
      'outgoing',
      'incoming',
      'outgoing',
      'incoming',
      'incoming',
    ]);
  });
});
