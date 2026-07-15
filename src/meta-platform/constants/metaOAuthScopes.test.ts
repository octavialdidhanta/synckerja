import { describe, expect, it } from 'vitest';
import {
  hasAllScopes,
  missingScopesForFeature,
  normalizeGrantedScopes,
} from '@/meta-platform/constants/metaOAuthScopes';

describe('metaOAuthScopes alias normalization', () => {
  it('expands instagram_business_manage_messages to canonical alias', () => {
    const normalized = normalizeGrantedScopes(['instagram_business_manage_messages', 'pages_messaging']);
    expect(normalized).toContain('instagram_manage_messages');
    expect(normalized).toContain('instagram_business_manage_messages');
  });

  it('expands instagram_business_basic to canonical alias', () => {
    const normalized = normalizeGrantedScopes(['instagram_business_basic']);
    expect(normalized).toContain('instagram_basic');
    expect(normalized).toContain('instagram_business_basic');
  });

  it('dedupes case-insensitive variants', () => {
    const normalized = normalizeGrantedScopes([
      'Pages_Show_List',
      'pages_show_list',
      'PAGES_SHOW_LIST',
    ]);
    expect(normalized.filter((s) => s.toLowerCase() === 'pages_show_list').length).toBeGreaterThan(0);
  });

  it('instagram_dm ok when only business-prefixed messaging scope granted', () => {
    const missing = missingScopesForFeature(
      ['instagram_business_manage_messages', 'pages_messaging'],
      'instagram_dm',
    );
    expect(missing).toEqual([]);
  });

  it('instagram_dm missing when pages_messaging absent', () => {
    const missing = missingScopesForFeature(['instagram_business_manage_messages'], 'instagram_dm');
    expect(missing).toContain('pages_messaging');
  });

  it('messenger_dm ok with pages scopes', () => {
    expect(
      hasAllScopes(['pages_messaging', 'pages_manage_metadata'], ['pages_messaging', 'pages_manage_metadata']),
    ).toBe(true);
  });

  it('pages feature ok with show_list + manage_metadata', () => {
    const missing = missingScopesForFeature(
      ['pages_show_list', 'pages_manage_metadata'],
      'pages',
    );
    expect(missing).toEqual([]);
  });
});
