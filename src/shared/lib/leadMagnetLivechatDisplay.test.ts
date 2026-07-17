import { describe, expect, it } from 'vitest';
import {
  extractLeadMagnetButtonTitles,
  humanizeLeadMagnetPayload,
  humanizeLeadMagnetPostbackBody,
  isLeadMagnetPostbackMessage,
  resolveLegacyLeadMagnetOutboundDisplay,
  stripLeadMagnetButtonSuffix,
} from './leadMagnetLivechatDisplay';

describe('leadMagnetLivechatDisplay', () => {
  it('humanizes lead magnet postback payload', () => {
    expect(humanizeLeadMagnetPayload('lm:abc-123:follow_confirm')).toBe('Sudah Follow');
    expect(humanizeLeadMagnetPayload('lm:abc-123:get_framework')).toBe('Ambil Materi');
  });

  it('prefers postback title over payload', () => {
    expect(
      humanizeLeadMagnetPostbackBody('lm:abc:follow_confirm', {
        postback: { title: 'Sudah Follow', payload: 'lm:abc:follow_confirm' },
      }),
    ).toBe('Sudah Follow');
  });

  it('strips legacy outbound button suffix', () => {
    const result = stripLeadMagnetButtonSuffix(
      'Hai user!\n\n[Tombol: Sudah Follow, Ambil Materi]',
    );
    expect(result.body).toBe('Hai user!');
    expect(result.buttonTitles).toEqual(['Sudah Follow', 'Ambil Materi']);
  });

  it('reads button titles from metadata', () => {
    const titles = extractLeadMagnetButtonTitles({
      lead_magnet_buttons: { buttons: [{ title: 'Unduh' }] },
    });
    expect(titles).toEqual(['Unduh']);
  });

  it('detects lead magnet postback messages from metadata payload', () => {
    expect(isLeadMagnetPostbackMessage('Sudah Follow', {
      postback: { payload: 'lm:abc:follow_confirm', title: 'Sudah Follow' },
    })).toBe(true);
  });

  it('resolves legacy outbound display', () => {
    const resolved = resolveLegacyLeadMagnetOutboundDisplay(
      'Hai!\n\n[Tombol: Sudah Follow]',
      null,
    );
    expect(resolved.body).toBe('Hai!');
    expect(resolved.buttonTitles).toEqual(['Sudah Follow']);
  });
});
