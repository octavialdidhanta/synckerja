import { describe, expect, it } from 'vitest';
import {
  ecommerceChatPlatformPath,
  parseEcommerceChatPlatform,
} from './ecommerceChatPaths';

describe('ecommerceChatPaths', () => {
  it('parses known platforms and defaults to all', () => {
    expect(parseEcommerceChatPlatform('shopee')).toBe('shopee');
    expect(parseEcommerceChatPlatform('TikTok')).toBe('tiktok');
    expect(parseEcommerceChatPlatform('blibli')).toBe('blibli');
    expect(parseEcommerceChatPlatform(undefined)).toBe('all');
    expect(parseEcommerceChatPlatform('other')).toBe('all');
  });

  it('builds platform paths', () => {
    expect(ecommerceChatPlatformPath('all')).toBe('/operations/sales/ecommerce-chat');
    expect(ecommerceChatPlatformPath('shopee')).toBe('/operations/sales/ecommerce-chat/shopee');
  });
});
