import { describe, expect, it } from 'vitest';
import {
  buildLeadMagnetAssetPublicUrl,
  isAllowedLeadMagnetDeliveryFileName,
  isAllowedLeadMagnetDeliveryMime,
  LEAD_MAGNET_DELIVERY_MAX_BYTES,
  parseLeadMagnetDeliveryMode,
  sanitizeLeadMagnetAssetFileName,
  validateLeadMagnetDeliveryFile,
  validateLeadMagnetDeliveryForm,
} from './leadMagnetDeliveryAsset';

describe('leadMagnetDeliveryAsset', () => {
  it('parseLeadMagnetDeliveryMode defaults to link', () => {
    expect(parseLeadMagnetDeliveryMode(undefined)).toBe('link');
    expect(parseLeadMagnetDeliveryMode('upload')).toBe('upload');
    expect(parseLeadMagnetDeliveryMode('LINK')).toBe('link');
  });

  it('buildLeadMagnetAssetPublicUrl encodes path segments', () => {
    const url = buildLeadMagnetAssetPublicUrl(
      'https://example.supabase.co/',
      'org-id/campaign-id/uuid_my file.pdf',
    );
    expect(url).toBe(
      'https://example.supabase.co/storage/v1/object/public/lead-magnet-assets/org-id/campaign-id/uuid_my%20file.pdf',
    );
  });

  it('validateLeadMagnetDeliveryFile rejects oversize and bad types', () => {
    const big = new File([new Uint8Array(LEAD_MAGNET_DELIVERY_MAX_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect(validateLeadMagnetDeliveryFile(big)).toBe('size');

    const exe = new File([new Uint8Array(10)], 'virus.exe', { type: 'application/octet-stream' });
    expect(validateLeadMagnetDeliveryFile(exe)).toBe('type');

    const pdf = new File([new Uint8Array(10)], 'guide.pdf', { type: 'application/pdf' });
    expect(validateLeadMagnetDeliveryFile(pdf)).toBeNull();
  });

  it('isAllowedLeadMagnetDeliveryMime and fileName accept office formats', () => {
    expect(isAllowedLeadMagnetDeliveryMime('application/pdf')).toBe(true);
    expect(
      isAllowedLeadMagnetDeliveryMime(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe(true);
    expect(isAllowedLeadMagnetDeliveryFileName('report.xlsx')).toBe(true);
    expect(isAllowedLeadMagnetDeliveryFileName('notes.txt')).toBe(false);
  });

  it('sanitizeLeadMagnetAssetFileName strips unsafe characters', () => {
    expect(sanitizeLeadMagnetAssetFileName('my framework.pdf')).toBe('my_framework.pdf');
    expect(sanitizeLeadMagnetAssetFileName('')).toBe('framework');
  });

  it('validateLeadMagnetDeliveryForm enforces delivery_links rules', () => {
    expect(
      validateLeadMagnetDeliveryForm({
        delivery_mode: 'link',
        delivery_url: 'http://bad.com',
      }),
    ).toBe('deliveryUrlHttps');

    expect(
      validateLeadMagnetDeliveryForm({
        delivery_mode: 'link',
        delivery_url: '',
        delivery_links: [],
      }),
    ).toBe('deliveryLinkRequired');

    expect(
      validateLeadMagnetDeliveryForm({
        delivery_mode: 'link',
        delivery_url: 'https://drive.google.com/file',
        delivery_links: [{ label: 'Kirim link-nya 😊', url: 'https://drive.google.com/file' }],
      }),
    ).toBeNull();

    expect(
      validateLeadMagnetDeliveryForm({
        delivery_mode: 'upload',
        delivery_url: 'https://example.supabase.co/storage/v1/object/public/lead-magnet-assets/a/b/c.pdf',
        delivery_links: [{
          label: 'Kirim link-nya 😊',
          url: 'https://example.supabase.co/storage/v1/object/public/lead-magnet-assets/a/b/c.pdf',
        }],
        delivery_storage_path: null,
        delivery_file_name: null,
      }),
    ).toBe('deliveryFileRequired');

    expect(
      validateLeadMagnetDeliveryForm({
        delivery_mode: 'upload',
        delivery_url: 'https://example.supabase.co/storage/v1/object/public/lead-magnet-assets/a/b/c.pdf',
        delivery_links: [{
          label: 'Kirim link-nya 😊',
          url: 'https://example.supabase.co/storage/v1/object/public/lead-magnet-assets/a/b/c.pdf',
        }],
        delivery_storage_path: 'org/camp/uuid_file.pdf',
        delivery_file_name: 'file.pdf',
      }),
    ).toBeNull();
  });
});
