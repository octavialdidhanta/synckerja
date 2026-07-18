import { describe, expect, it } from 'vitest';
import { isLikelyPdf, summarizeCampaignLeadMagnet } from './summarizeCampaignLeadMagnet';

const base = {
  delivery_mode: 'link' as const,
  delivery_links: [] as Array<{ label: string; url: string }>,
  delivery_button_label: '',
  delivery_url: '',
  delivery_storage_path: null as string | null,
  delivery_file_name: null as string | null,
  delivery_file_mime: null as string | null,
  delivery_file_size_bytes: null as number | null,
  delivery_text: '',
};

describe('summarizeCampaignLeadMagnet', () => {
  it('summarizes single link by label', () => {
    const s = summarizeCampaignLeadMagnet(
      {
        ...base,
        delivery_links: [{ label: 'Download PDF', url: 'https://example.com/a.pdf' }],
      },
      'https://proj.supabase.co',
    );
    expect(s.hasContent).toBe(true);
    expect(s.label).toBe('Download PDF');
    expect(s.mode).toBe('link');
  });

  it('shows +N for multiple links', () => {
    const s = summarizeCampaignLeadMagnet(
      {
        ...base,
        delivery_links: [
          { label: 'Link A', url: 'https://a.com' },
          { label: 'Link B', url: 'https://b.com' },
        ],
      },
      'https://proj.supabase.co',
    );
    expect(s.label).toBe('Link A +1');
  });

  it('prefers button label over upload file name', () => {
    const s = summarizeCampaignLeadMagnet(
      {
        ...base,
        delivery_mode: 'upload',
        delivery_file_name: 'framework.pdf',
        delivery_storage_path: 'org/camp/file.pdf',
        delivery_file_size_bytes: 2048,
        delivery_links: [{ label: 'Akses Modul', url: 'https://example.com' }],
      },
      'https://proj.supabase.co',
    );
    expect(s.label).toBe('Akses Modul');
    expect(s.mode).toBe('upload');
    expect(s.filePublicUrl).toContain('/lead-magnet-assets/');
    expect(s.fileSizeLabel).toBe('2.0 KB');
  });

  it('falls back to file name when upload has no button label', () => {
    const s = summarizeCampaignLeadMagnet(
      {
        ...base,
        delivery_mode: 'upload',
        delivery_file_name: 'framework.pdf',
        delivery_storage_path: 'org/camp/file.pdf',
        delivery_links: [],
        delivery_button_label: '',
        delivery_url: '',
      },
      'https://proj.supabase.co',
    );
    expect(s.label).toBe('framework.pdf');
  });

  it('returns empty when nothing configured', () => {
    const s = summarizeCampaignLeadMagnet(base, 'https://proj.supabase.co');
    expect(s.hasContent).toBe(false);
    expect(s.label).toBe('');
  });

  it('detects pdf by name mime or url', () => {
    expect(isLikelyPdf({ fileName: 'a.PDF' })).toBe(true);
    expect(isLikelyPdf({ mime: 'application/pdf' })).toBe(true);
    expect(isLikelyPdf({ url: 'https://x.com/a.pdf?x=1' })).toBe(true);
    expect(isLikelyPdf({ fileName: 'a.docx' })).toBe(false);
  });
});
