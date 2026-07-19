import { describe, expect, it } from 'vitest';
import {
  buildBlibliChatIframeUrl,
  isBlibliIframeUrl,
} from './blibliSellerChat';

describe('blibliSellerChat', () => {
  it('builds iframe URL with encoded token', () => {
    expect(buildBlibliChatIframeUrl('abc+1', 'https://seller.blibli.com/')).toBe(
      'https://seller.blibli.com/conversations?authToken=abc%2B1&mode=iframe',
    );
  });

  it('validates https iframe URLs', () => {
    expect(
      isBlibliIframeUrl(
        'https://seller.blibli.com/conversations?authToken=x&mode=iframe',
      ),
    ).toBe(true);
    expect(isBlibliIframeUrl('http://seller.blibli.com/conversations?authToken=x&mode=iframe')).toBe(
      false,
    );
    expect(isBlibliIframeUrl('not-a-url')).toBe(false);
  });
});
