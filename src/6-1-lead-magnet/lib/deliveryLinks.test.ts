import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DELIVERY_LINK_LABEL,
  getDeliveryUrlAtIndex,
  mirrorDeliveryFieldsFromLinks,
  normalizeDeliveryLinks,
  resolveDeliveryLinks,
  truncateDeliveryButtonLabel,
  validateDeliveryLinksForPublish,
} from './deliveryLinks';

describe('deliveryLinks', () => {
  it('normalizeDeliveryLinks trims, truncates label, caps at 3', () => {
    const links = normalizeDeliveryLinks([
      { label: '  Short  ', url: ' https://a.com ' },
      { label: 'x'.repeat(30), url: 'https://b.com' },
      { label: 'Three', url: 'https://c.com' },
      { label: 'Four', url: 'https://d.com' },
      { label: '', url: '' },
    ]);
    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({ label: 'Short', url: 'https://a.com' });
    expect(links[1].label).toHaveLength(20);
    expect(links[2].label).toBe('Three');
  });

  it('resolveDeliveryLinks falls back to legacy fields', () => {
    expect(resolveDeliveryLinks({ delivery_links: [] })).toEqual([]);
    expect(
      resolveDeliveryLinks({
        delivery_button_label: 'Unduh',
        delivery_url: 'https://example.com/f.pdf',
      }),
    ).toEqual([{ label: 'Unduh', url: 'https://example.com/f.pdf' }]);
  });

  it('mirrorDeliveryFieldsFromLinks uses first slot', () => {
    expect(mirrorDeliveryFieldsFromLinks([])).toEqual({
      delivery_url: '',
      delivery_button_label: DEFAULT_DELIVERY_LINK_LABEL,
    });
    expect(
      mirrorDeliveryFieldsFromLinks([
        { label: 'A', url: 'https://a.com' },
        { label: 'B', url: 'https://b.com' },
      ]),
    ).toEqual({ delivery_url: 'https://a.com', delivery_button_label: 'A' });
  });

  it('validateDeliveryLinksForPublish enforces min 1, HTTPS, label', () => {
    expect(validateDeliveryLinksForPublish([])).toBe('deliveryLinkRequired');
    expect(
      validateDeliveryLinksForPublish([{ label: '', url: 'https://a.com' }]),
    ).toBe('deliveryLinkLabelRequired');
    expect(
      validateDeliveryLinksForPublish([{ label: 'Ok', url: 'http://insecure' }]),
    ).toBe('deliveryUrlHttps');
    expect(
      validateDeliveryLinksForPublish([
        { label: 'One', url: 'https://a.com' },
        { label: 'Two', url: 'https://b.com' },
        { label: 'Three', url: 'https://c.com' },
      ]),
    ).toBeNull();
  });

  it('getDeliveryUrlAtIndex resolves by index with fallback', () => {
    const links = [
      { label: 'A', url: 'https://a.com' },
      { label: 'B', url: 'https://b.com' },
    ];
    expect(getDeliveryUrlAtIndex(links, 1)).toBe('https://b.com');
    expect(getDeliveryUrlAtIndex([], 0, 'https://legacy.com')).toBe('https://legacy.com');
    expect(getDeliveryUrlAtIndex(links, 2)).toBeNull();
  });

  it('truncateDeliveryButtonLabel caps at 20', () => {
    expect(truncateDeliveryButtonLabel('Kirim link-nya 😊').length).toBeLessThanOrEqual(20);
  });
});
