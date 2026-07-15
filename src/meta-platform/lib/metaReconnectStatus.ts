import { missingScopesForFeature } from '@/meta-platform/constants/metaOAuthScopes';

export type MetaDmFeature = 'instagram_dm' | 'messenger_dm';

function parseGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

export function accountNeedsMetaReconnect(
  grantedScopes: unknown,
  feature: MetaDmFeature,
): boolean {
  const granted = parseGrantedScopes(grantedScopes);
  return missingScopesForFeature(granted, feature).length > 0;
}

export function anyAccountNeedsMetaReconnect(
  accounts: Array<{ granted_scopes?: unknown }>,
  feature: MetaDmFeature,
): boolean {
  return accounts.some((acc) => accountNeedsMetaReconnect(acc.granted_scopes, feature));
}
