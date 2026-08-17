import { describe, expect, it } from 'vitest';
import type { CustomerVisitLeadEmbed } from './customerVisit.types';
import { customerVisitLeadContent } from './customerVisitLeadContent';

function lead(partial: Partial<CustomerVisitLeadEmbed> = {}): CustomerVisitLeadEmbed {
  return {
    id: 'lead-1',
    client: '@hary.belajarai',
    ticket_id: 'IG-EAB45F82',
    source: 'Lead Magnet',
    phone_number: null,
    ...partial,
  };
}

describe('customerVisitLeadContent', () => {
  it('uses the latest enrollment campaign name and matching post caption', () => {
    const content = customerVisitLeadContent(
      lead({
        lead_magnet_enrollments: [
          {
            created_at: '2026-08-01T00:00:00.000Z',
            media_id: 'old',
            platform: 'instagram',
            lead_magnet_campaigns: { name: 'Old campaign' },
          },
          {
            created_at: '2026-08-16T00:00:00.000Z',
            media_id: 'media-9',
            platform: 'instagram',
            lead_magnet_campaigns: {
              name: 'Framework Juli',
              lead_magnet_campaign_posts: [
                {
                  media_id: 'media-9',
                  platform: 'instagram',
                  media_caption: 'Cara tutup toko tanpa rugi\nBaris dua',
                  media_permalink: 'https://instagram.com/p/abc',
                },
              ],
            },
          },
        ],
      }),
    );
    expect(content).toEqual({
      title: 'Framework Juli',
      subtitle: 'Cara tutup toko tanpa rugi',
      href: 'https://instagram.com/p/abc',
    });
  });

  it('falls back to utm_content when there is no enrollment', () => {
    expect(
      customerVisitLeadContent(
        lead({
          source: 'Website',
          attribution: { utm_content: 'hero-banner' },
        }),
      ),
    ).toEqual({ title: 'hero-banner', subtitle: null, href: null });
  });

  it('returns null when unmatched or empty', () => {
    expect(customerVisitLeadContent(null)).toBeNull();
    expect(customerVisitLeadContent(lead({ source: 'Instagram' }))).toBeNull();
  });
});
